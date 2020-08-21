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
  res.send(`${process.env.HEROKU_APP_NAME}.glitch.me`);
});

app.get("/getSites", async (req, res) => {
  const sites = await tableau.getSites();
  res.send({id: tableau.siteID, sites});
});

app.get("/switchSite/:contentUrl?", async (req, res) => {
  const data = await tableau.switchSite(req.params.contentUrl || "");
  await database.populateWebhooks();
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
  console.log(`Webhook ${req.params.id} triggered!`);
  
  const webhook = await database.getWebhook(req.params.id);
  console.log(webhook)

  let body = {};

  try {
    body = JSON.parse(req.body);
  } catch (err) {
    console.log("Either something went wrong or that was a test!");
  }

  if (
    Object.keys(body).length !== 0 &&
    webhook.custommessageenabled &&
    body.resource_luid
  ) {
    const type = webhookTypes.find(type => type.name === webhook.type);
    const resource = await tableau.getResource(
      type.resource,
      body.resource_luid
    );
    const project = await tableau.getResourceByName(
      "project",
      resource.project.name
    );
    let image = "";
    if (type.resource === "workbook") {
      image = await tableau.getWorkbookImage(body.resource_luid);
    }
    const date = moment.utc(body.created_at).tz(process.env.TIMEZONE || "UTC");
    const createdAt = moment.utc(resource.createdAt).tz(process.env.TIMEZONE || "UTC");
    const updatedAt = moment.utc(resource.updatedAt).tz(process.env.TIMEZONE || "UTC");

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
      workbook_image: image,
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
  } else {
    body = JSON.stringify({ message: req.body });
  }

  const options = {
    method: "POST",
    body,
    headers: {
      "Content-Type": "application/json"
    }
  };
  
  const response = await fetch(webhook.routeurl, options);
  res.status(response.status).send(response.statusText);
});

const listener = app.listen(process.env.PORT, () => {
  console.log("Your app is listening on port " + listener.address().port);
});
