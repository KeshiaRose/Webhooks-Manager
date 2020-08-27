const express = require("express");
const fetch = require("node-fetch");
var moment = require("moment-timezone");
const tableau = require("./tableau");
const database = require("./database");
const app = express();

const webhookTypes = [
  {
    label: "Data source refresh started",
    resource: "dataSource",
    name: "webhook-source-event-datasource-refresh-started"
  },
  {
    label: "Data source refresh succeeded",
    resource: "dataSource",
    name: "webhook-source-event-datasource-refresh-succeeded"
  },
  {
    label: "Data source refresh failed",
    resource: "dataSource",
    name: "webhook-source-event-datasource-refresh-failed"
  },
  {
    label: "Data source updated",
    resource: "dataSource",
    name: "webhook-source-event-datasource-updated"
  },
  {
    label: "Data source created",
    resource: "dataSource",
    name: "webhook-source-event-datasource-created"
  },
  {
    label: "Data source deleted",
    resource: "dataSource",
    name: "webhook-source-event-datasource-deleted"
  },
  {
    label: "Workbook updated",
    resource: "workbook",
    name: "webhook-source-event-workbook-updated"
  },
  {
    label: "Workbook created",
    resource: "workbook",
    name: "webhook-source-event-workbook-created"
  },
  {
    label: "Workbook deleted",
    resource: "workbook",
    name: "webhook-source-event-workbook-deleted"
  },
  {
    label: "Workbook refresh started",
    resource: "workbook",
    name: "webhook-source-event-workbook-refresh-started"
  },
  {
    label: "Workbook refresh succeeded",
    resource: "workbook",
    name: "webhook-source-event-workbook-refresh-succeeded"
  },
  {
    label: "Workbook refresh failed",
    resource: "workbook",
    name: "webhook-source-event-workbook-refresh-failed"
  }
];

app.use(tableau.authenticated);
app.use(express.static("public"));
app.use(express.text({ type: ["text/plain", "application/json"] }));

database.initializeTables();

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/views/index.html");
});

app.get("/listResources/:type", async (req, res) => {
  const data = await tableau.listResources(req.params.type);
  res.send(data);
});

app.get("/getDomain", async (req, res) => {
  res.send(`${process.env.HEROKU_APP_NAME}.herokuapp.com`);
});

app.get("/getSites", async (req, res) => {
  const sites = await tableau.getSites();
  res.send({ id: tableau.siteID, sites });
});

app.get("/switchSite/:contentUrl?", async (req, res) => {
  const data = await tableau.switchSite(req.params.contentUrl || "");
  await database.populateWebhooks();
  res.send(data);
});

app.get("/getHistory/:id", async (req, res) => {
  let data = await database.getHistory(req.params.id);
  data = data.map(d => {
    return {
      ...d,
      timestamp: moment
        .utc(d.timestamp)
        .tz(process.env.TIMEZONE || "UTC")
        .format("L LTS")
    };
  });
  res.send(data);
});

app.get("/getResource/:type/:id", async (req, res) => {
  let data = await tableau.getResource(req.params.type, req.params.id);
  if (data && req.params.type === "webhook") {
    const dbWebhook = await database.getWebhook(req.params.id);
    data = { ...data, ...dbWebhook };
  }
  res.send(data);
});

app.post("/createResource/:type", async (req, res) => {
  const data = await tableau.createResource(req.params.type, req.body);
  res.send(data);
});

app.put("/updateResource/:type/:id", async (req, res) => {
  const data = await tableau.updateResource(
    req.params.type,
    req.params.id,
    req.body
  );
  res.send(data);
});

app.delete("/deleteResource/:type/:id", async (req, res) => {
  const data = await tableau.deleteResource(req.params.type, req.params.id);
  res.send({ status: data });
});

app.get("/testWebhook/:id", async (req, res) => {
  const data = await tableau.testWebhook(req.params.id);
  res.send(data);
});

app.put("/updateWebhook", async (req, res) => {
  const data = await database.updateWebhook(req.body);
  res.send(data);
});

app.post("/createWebhook", async (req, res) => {
  const data = await database.createWebhook(req.body);
  res.send(data);
});

app.delete("/deleteWebhook/:id", async (req, res) => {
  const data = await database.deleteWebhook(req.params.id);
  res.send(data);
});

app.post("/event/:id", async (req, res) => {
  console.log(`Webhook ${req.params.id} received!`);

  const webhook = await database.getWebhook(req.params.id);

  let body = {};

  // Catch tests
  try {
    body = JSON.parse(req.body);
  } catch (err) {
    const options = {
      method: "POST",
      body: JSON.stringify({ message: req.body }),
      headers: {
        "Content-Type": "application/json"
      }
    };
    const response = await fetch(webhook.routeurl, options);
    database.logHistory({
      id: req.params.id,
      resourceID: "",
      eventType: webhook.type,
      responseCode: response.status
    });
    console.log(`Webhook ${req.params.id} sent!`);
    res.status(response.status).send(response.statusText);
    console.log("Either something went wrong or that was a test!");
    return;
  }

  const type = webhookTypes.find(type => type.name === webhook.type);
  const resource = await tableau.getResource(type.resource, body.resource_luid);
  const project = await tableau.getResourceByName("project", resource.project.name);

  if (webhook.custommessageenabled && body.resource_luid) {
    // let image = "";
    // if (type.resource === "workbook") {
    //   image = await tableau.getWorkbookImage(body.resource_luid);
    // }
    const date = moment.utc(body.created_at).tz(process.env.TIMEZONE || "UTC");
    const createdAt = moment
      .utc(resource.createdAt)
      .tz(process.env.TIMEZONE || "UTC");
    const updatedAt = moment
      .utc(resource.updatedAt)
      .tz(process.env.TIMEZONE || "UTC");

    const templateStrings = {
      event_type: type.label || "",
      resource_type: type.resource || "",
      project_name: project.name || "",
      project_id: project.id || "",
      resource_name: resource.name || "",
      resource_id: resource.id || "",
      resource_description: resource.description || "",
      resource_url: resource.webpageUrl || "",
      resource_created: createdAt.format("L LTS") || "",
      resource_updated: updatedAt.format("L LTS") || "",
      // workbook_image: image,
      site_id: tableau.siteID || "",
      timestamp: date.format("L LTS"),
      day: date.format("L"),
      time: date.format("LTS")
    };

    body = JSON.stringify(webhook.message);
    for (let template of Object.keys(templateStrings)) {
      const re = new RegExp(`{{${template}}}`, "g");
      body = body.replace(re, templateStrings[template]);
    }
  }

  const options = {
    method: "POST",
    body,
    headers: {
      "Content-Type": "application/json"
    }
  };
  
  const inProjects = webhook.filters.projects.includes(project.id);
  const inResources = webhook.filters.resources.includes(body.resource_luid);

  if (!webhook.filtersenabled || (inProjects || inResources)) {
    const response = await fetch(webhook.routeurl, options);
    database.logHistory({
      id: req.params.id,
      resourceID: (resource && resource.id) || "",
      eventType: webhook.type,
      responseCode: response.status
    });
    console.log(`Webhook ${req.params.id} sent!`);
    res.status(response.status).send(response.statusText);
  } else {
    res.status(200).send();
  }
});

const listener = app.listen(process.env.PORT, () => {
  console.log("Your app is listening on port " + listener.address().port);
});
