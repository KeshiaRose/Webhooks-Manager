const fetch = require("node-fetch");

module.exports.siteID = "";
let urlBase = process.env.SERVER + "/api/" + process.env.VERSION;
let headers = {
  "Content-Type": "application/json",
  Accept: "application/json"
};

// Authenticate and receive a token
async function signIn(req, res, next) {
  const url = `${process.env.SERVER}/api/${process.env.VERSION}/auth/signin`;

  const body = {
    credentials: {
      site: {
        contentUrl: process.env.SITE_NAME || ""
      },
      personalAccessTokenName: process.env.PAT_NAME,
      personalAccessTokenSecret: process.env.PAT_SECRET
    }
  };

  const options = {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  };

  const response = await fetch(url, options);
  const data = await response.json();
  if (data.credentials) {
    headers["X-Tableau-Auth"] = data.credentials.token;
    urlBase =
      process.env.SERVER +
      "/api/" +
      process.env.VERSION +
      "/sites/" +
      data.credentials.site.id;
    module.exports.siteID = data.credentials.site.id;
    if (next) next();
  } else {
    res.send({
      error: `Error signing in to Tableau Server: ${JSON.stringify(data.error)}`
    });
  }
}

// Get current site
async function getCurrentSite() {
  const options = {
    method: "GET",
    headers
  };

  const response = await fetch(urlBase, options);
  const data = await response.json();
  return data;
}

// Switch to different site
module.exports.switchSite = async contentUrl => {
  const url = `${process.env.SERVER}/api/${process.env.VERSION}/auth/switchSite`;
  const options = {
    method: "POST",
    headers,
    body: JSON.stringify({
      site: {
        contentUrl
      }
    })
  };

  const response = await fetch(url, options);
  const data = await response.json();
  if (data.credentials) {
    headers["X-Tableau-Auth"] = data.credentials.token;
    urlBase =
      process.env.SERVER +
      "/api/" +
      process.env.VERSION +
      "/sites/" +
      data.credentials.site.id;
    module.exports.siteID = data.credentials.site.id;
  }
  return data;
};

// Get all sites
module.exports.getSites = async () => {
  if (process.env.SERVER.includes("online.tableau.com")) {
    let site = await getCurrentSite();
    return [site.site];
  }
  let page = 1;
  const url = `${process.env.SERVER}/api/${process.env.VERSION}/sites?pageNumber=`;
  const options = {
    method: "GET",
    headers
  };

  let sites = [];
  let morePages = true;

  do {
    const response = await fetch(`${url}${page}`, options);
    const data = await response.json();
    if (data.error) return data;

    morePages =
      data.pagination.totalAvailable >
      data.pagination.pageNumber * data.pagination.pageSize;
    for (let resource of data.sites.site) {
      sites.push(resource);
    }
    page++;
  } while (morePages);

  return sites;
};

// Get all of a certain resource type
module.exports.listResources = async type => {
  type = type.toLowerCase();
  const url = `${urlBase}/${type}s?pageNumber=`;
  let page = 1;

  const options = {
    method: "GET",
    headers
  };

  let resources = [];
  let morePages = true;

  do {
    const response = await fetch(`${url}${page}`, options);
    const data = await response.json();
    if (data.error) return data;

    morePages = data.totalAvailable > data.pageNumber * data.pageSize;
    if(data[`${type}s`][type]) {
      for (let resource of data[`${type}s`][type]) {
        resources.push(resource);
      }
    }
    page++;
  } while (morePages);

  return resources;
};

// Get a specific resource by type and id
module.exports.getResource = async (type, id) => {
  const url = `${urlBase}/${type}s/${id}`;

  const options = {
    method: "GET",
    headers
  };

  const response = await fetch(url, options);
  const data = await response.json();
  if (data.error) return data;

  return data[type];
};

// Get a specific resource by type and name
module.exports.getResourceByName = async (type, name) => {
  const url = `${urlBase}/${type}s?filter=name:eq:${name}`;

  const options = {
    method: "GET",
    headers
  };

  const response = await fetch(url, options);
  const data = await response.json();
  if (data.error) return data;

  return data[`${type}s`][type][0];
};

// Update a specific resource by type and id with a body
module.exports.updateResource = async (type, id, body) => {
  const url = `${urlBase}/${type}s/${id}`;
  const options = {
    method: "PUT",
    headers,
    body
  };

  const response = await fetch(url, options);
  const data = await response.json();
  if (data.error) return data;

  return data[type];
};

// Create a new resource by type with a body
module.exports.createResource = async (type, body) => {
  const url = `${urlBase}/${type}s`;
  const options = {
    method: "POST",
    headers,
    body
  };

  const response = await fetch(url, options);
  const data = await response.json();
  if (data.error) return data;

  return data[type];
};

// Delete a specific resource by type and id
module.exports.deleteResource = async (type, id) => {
  const url = `${urlBase}/${type}s/${id}`;
  const options = {
    method: "DELETE",
    headers
  };

  const response = await fetch(url, options);
  return response.status;
};

// Test a webhook
module.exports.testWebhook = async id => {
  const url = `${urlBase}/webhooks/${id}/test`;
  const options = {
    method: "GET",
    headers
  };

  const response = await fetch(url, options);
  const data = await response.json();
  return data;
};

// Get a workbook preview image
module.exports.getWorkbookImage = async id => {
  const url = `${urlBase}/workbooks/${id}/previewImage`;
  const options = {
    method: "GET",
    headers
  };

  try {
    const response = await fetch(url, options);
    const blob = await response.blob();
    let buff = new Buffer.from(await blob.arrayBuffer());
    return buff.toString("base64");
  } catch (err) {
    return JSON.stringify(err);
  }
};

// Make sure to be authenticated when making calls
module.exports.authenticated = async (req, res, next) => {
  if (!headers["X-Tableau-Auth"]) {
    await signIn(req, res, next);
  } else {
    let data = await getCurrentSite;
    data.error ? await signIn(req, res, next) : next();
  }
};
