const { Pool } = require("pg");
const tableau = require("./tableau");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Create tables if they don't exist
module.exports.initializeTables = async () => {
  await tableau.authenticated();
  const siteID = tableau.siteID;

  const createTables = `
    CREATE TABLE IF NOT EXISTS webhooks (
      webhookLUID varchar(50) PRIMARY KEY NOT NULL,
      siteLUID varchar(50) NOT NULL,
      created   timestamp DEFAULT current_timestamp,
      updated   timestamp DEFAULT current_timestamp,
      type varchar(50) NOT NULL,
      url varchar(100),
      routeURL varchar(100) NOT NULL,
      method varchar(10) DEFAULT 'POST',
      filtersEnabled boolean DEFAULT false NOT NULL,
      filters json,
      customMessageEnabled boolean DEFAULT false NOT NULL,
      advancedMode boolean DEFAULT false NOT NULL,
      templateID integer DEFAULT 1 NOT NULL,
      message json
    );

    CREATE TABLE IF NOT EXISTS history (
      webhookLUID varchar(50) NOT NULL,
      timestamp timestamp DEFAULT current_timestamp,
      resourceLUID varchar(50) NOT NULL,
      eventType varchar(50) NOT NULL,
      responseCode integer NOT NULL
    );
  `;

  await pool.query(createTables);
  await module.exports.populateWebhooks(siteID);
};

module.exports.populateWebhooks = async () => {
  const webhookValues = await getWebhooksFromTableau(tableau.siteID);
  if (webhookValues) {
    for (let webhook of webhookValues) {
      let updateWebhooks = `
        INSERT INTO webhooks (webhookLUID, siteLUID, url, routeURL, type)
        VALUES($1, $2, $3, $3, $4)
        ON CONFLICT (webhookLUID)
        DO
          UPDATE SET updated = now(), url = $3;
      `;
      await pool.query(updateWebhooks, webhook);
    }
  }
}

async function getWebhooksFromTableau(siteID) {
  let insertValues = [];
  let webhooks = await tableau.listResources("webhook");
  if (webhooks.error) return false;
  for (let webhook of webhooks) {
    insertValues.push([
      webhook.id,
      siteID,
      webhook["webhook-destination"]["webhook-destination-http"].url,
      Object.keys(webhook["webhook-source"])[0]
    ]);
  }
  return insertValues;
}

module.exports.getWebhook = async webhookID => {
  const query = `SELECT type, routeURL, filtersEnabled, filters, customMessageEnabled, message, advancedMode, templateID FROM webhooks WHERE webhookLUID = $1`;
  const res = await pool.query(query, [webhookID]);
  return res.rows[0];
  // TODO add error handling
  // TODO if no webhook found in database
};

module.exports.createWebhook = async webhook => {
  webhook = JSON.parse(webhook);
  const query = `
    INSERT INTO webhooks (webhookLUID, siteLUID, type, routeURL, filtersenabled, filters, customMessageEnabled, message, advancedMode, templateID)
    VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
`;

  try {
    const res = await pool.query(query, [
      webhook.id,
      tableau.siteID,
      webhook.type,
      webhook.url,
      webhook.filtersEnabled,
      webhook.filters,
      webhook.customMessageEnabled,
      webhook.message,
      webhook.advancedMode,
      webhook.templateID
    ]);
    return { success: true };
  } catch (error) {
    console.log(error);
    return { error };
  }
};

module.exports.updateWebhook = async webhook => {
  webhook = JSON.parse(webhook);
  const query = `
    UPDATE webhooks
    SET updated = now(),
        routeurl = $2,
        filtersenabled = $3,
        filters = $4,
        custommessageenabled = $5,
        message = $6,
        advancedMode = $7,
        templateID = $8,
        type = $9
    WHERE webhookLUID = $1;
`;
  try {
    const res = await pool.query(query, [
      webhook.id,
      webhook.url,
      webhook.filtersEnabled,
      webhook.filters,
      webhook.customMessageEnabled,
      webhook.message,
      webhook.advancedMode,
      webhook.templateID,
      webhook.type
    ]);
    return { success: true };
  } catch (error) {
    console.log(error);
    return { error };
  }
};

module.exports.deleteWebhook = async webhookID => {
  const query = `DELETE FROM webhooks WHERE webhookLUID = $1`;
  try {
    const res = await pool.query(query, [webhookID]);
    return { success: true };
  } catch (error) {
    console.log(error);
    return { error };
  }
};
