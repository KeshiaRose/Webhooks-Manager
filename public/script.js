/* global Vue templates webhookTypes modalTemplate */

refreshWebhooksList();

async function switchSite(select) {
  const response = await fetch(`/switchSite/${select.value}`);
  let data = await response.json();
  if (data.error) return toast("error", "Error switching sites");
  toast("success","Switching sites...")
  setTimeout(function(){ location.reload() }, 2000);
}

async function refreshWebhooksList() {
  const responseSites = await fetch("/getSites");
  let {id, sites} = await responseSites.json();
  sites.sort((a,b) => a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1)
  console.log(sites)
  sites = sites.map(site => `<option value="${site.contentUrl}" ${site.id === id ? "selected" : ""}>${site.name}</option>`).join("")
  $("#sites").html(sites);
  
  const responseWebhooks = await fetch("/listResources/webhook");
  const webhooks = await responseWebhooks.json();
  if (webhooks.error) return info("error", JSON.stringify(webhooks.error));
  if (webhooks.length === 0)
    return info("normal", "No webhooks found on this site.");

  let output = "";
  webhooks.sort((a, b) =>
    a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1
  );
  for (let webhook of webhooks) {
    const type = webhookTypes.find(
      type => type.name === Object.keys(webhook["webhook-source"])[0]
    );

    output += `
        <div class="webhook">
          <div class="webhookLeft">
            <div class="icon ${type.resource}Icon"></div>
            <p class="webhookName" onclick="editWebhook('${webhook.id}')">${webhook.name}</p>
            <p class="webhookType">${type.label}</p>
          </div>
          <div class="actions" onclick="toggleActionTooltip('${webhook.id}')">
            <div class="actionTooltip hidden" id="action_${webhook.id}">
              <span class="tooltipVariable" onclick="return takeAction('${webhook.id}', 'edit', event)">Edit</span>
              <span class="tooltipVariable" onclick="return takeAction('${webhook.id}', 'test', event)">Test</span>
              <span class="tooltipVariable" onclick="return takeAction('${webhook.id}', '${webhook.isEnabled ? "disable" : "enable"}', event)">${webhook.isEnabled ? "Disable" : "Enable"}</span>
              <span class="tooltipVariable" onclick="return takeAction('${webhook.id}', 'duplicate', event)">Duplicate</span>
              <span class="tooltipVariable" onclick="return takeAction('${webhook.id}', 'delete', event)">Delete</span>
            </div>
          </div>
        </div>
    `;
  }
  $("#webhooksList").html(output);
}

async function createWebhook(webhook) {
  const { type, name, enabled } = webhook;
  const body = {
    webhook: {
      "webhook-source": {},
      "webhook-destination": {
        "webhook-destination-http": {
          method: "POST",
          url: "https://cyber-snapdragon-shoulder.glitch.me/" //Just a placeholder
        }
      },
      name,
      isEnabled: enabled
    }
  };
  body.webhook["webhook-source"][type] = {};

  // Create webhook in Tableau and get id
  const tableauResponse = await fetch(`/createResource/webhook`, {
    method: "POST",
    body: JSON.stringify(body)
  });
  const tableauData = await tableauResponse.json();
  if (tableauData.error) return tableauData;

  const domainResponse = await fetch(`/getDomain`);
  const domain = await domainResponse.text();
  body.webhook["webhook-destination"][
    "webhook-destination-http"
  ].url = `https://${domain}/event/${tableauData.id}`;

  // Update Tableau to this app url with webhook id
  const updateResponse = await fetch(
    `/updateResource/webhook/${tableauData.id}`,
    { method: "PUT", body: JSON.stringify(body) }
  );
  const updateData = await updateResponse.json();
  if (updateData.error) return updateData;

  // Create webhook in database
  const databaseResponse = await fetch(`/createWebhook`, {
    method: "POST",
    body: JSON.stringify({ ...webhook, id: tableauData.id })
  });
  const databaseData = await databaseResponse.json();
  if (databaseData.error) return databaseData;

  return tableauData;
}

async function updateWebhook(webhook) {
  const { id, type, url, name, enabled } = webhook;
  const body = {
    webhook: {
      "webhook-source": {},
      "webhook-destination": {
        "webhook-destination-http": {
          method: "POST"
        }
      },
      name,
      isEnabled: enabled
    }
  };
  body.webhook["webhook-source"][type] = {};

  const domainResponse = await fetch(`/getDomain`);
  const domain = await domainResponse.text();
  body.webhook["webhook-destination"][
    "webhook-destination-http"
  ].url = `https://${domain}/event/${id}`;
  
  console.log(webhook)
  const tableauResponse = await fetch(`/updateResource/webhook/${id}`, {
    method: "PUT",
    body: JSON.stringify(body)
  });
  const tableauData = await tableauResponse.json();
  if (tableauData.error) return tableauData;

  const databaseResponse = await fetch(`/updateWebhook`, {
    method: "PUT",
    body: JSON.stringify(webhook)
  });
  const databaseData = await databaseResponse.json();
  if (databaseData.error) return databaseData;
  return tableauData;
}

async function duplicateWebhook(webhookID) {
  const response = await fetch(`/getResource/webhook/${webhookID}`);
  const webhook = await response.json();
  const webhookBody = {
    advancedMode: webhook.advancedmode,
    customMessageEnabled: webhook.custommessageenabled,
    enabled: webhook.isEnabled,
    filters: webhook.filters,
    filtersEnabled: webhook.filtersenabled,
    message: webhook.message,
    name: webhook.name + "(Copy)",
    templateID: webhook.templateid,
    type: Object.keys(webhook["webhook-source"])[0],
    url: webhook.routeurl
  };
  saveNewWebhook(webhookBody);
}

async function deleteWebhook(webhookID) {
  showModal("infoModal");
  const tableauResponse = await fetch(`/deleteResource/webhook/${webhookID}`, {
    method: "DELETE"
  });
  const tableauData = await tableauResponse.json();
  if (tableauData.status !== 204) {
    closeModal("infoModal");
    toast("error", "Error deleting webhook.");
    return;
  }
  const databaseResponse = await fetch(`/deleteWebhook/${webhookID}`, {
    method: "DELETE"
  });
  const databaseData = await databaseResponse.json();
  if (databaseData.error) {
    closeModal("infoModal");
    toast("error", "Error deleting webhook.");
    return;
  }
  await refreshWebhooksList();
  closeModal("infoModal");
  closeModal("editWebhookModal");
  toast("success", "Webhook deleted!");
}

async function testWebhook(webhookID) {
  const response = await fetch(`/testWebhook/${webhookID}`);
  const body = await response.json();
  closeModal("infoModal");
  closeModal("editWebhookModal");
  toast(
    body.webhookTestResult.status === 200 ? "success" : "warning",
    `Webhook responded with a ${body.webhookTestResult.status} status!`
  );
}

async function toggleWebhook(webhookID, state) {
  showModal("infoModal");
  const body = {
    webhook: {
      isEnabled: state
    }
  };
  const tableauResponse = await fetch(`/updateResource/webhook/${webhookID}`, {
    method: "PUT",
    body: JSON.stringify(body)
  });
  const tableauData = await tableauResponse.json();
  closeModal("infoModal");
  if (tableauData.error) return toast("error", `Error when trying to ${state ? "enable" : "disable"} webhook.`);
  await refreshWebhooksList();
  return toast("success", `Successfully ${state ? "enabled" : "disabled"} webhook.`);
}

async function listResources(resource) {
  const response = await fetch(`/listResources/${resource}`);
  const resources = await response.json();
  if (resources.error) return infoModal("error", resources.error);
  resources.map(r => (r["checked"] = false)); // TODO pull checked from database
  return resources;
}

async function newWebhook() {
  showModal("editWebhookModal");
  $("#editModalTitle").html("Create New Webhook");
  $("#editWebhookModalBody").html(modalTemplate);

  let editVue = new Vue({
    el: "#editWebhookModalBody",
    data: {
      name: "",
      type: "webhook-source-event-datasource-refresh-started",
      url: "",
      method: "POST",
      enabled: true,
      tab: 1,
      filtersEnabled: false,
      customMessageEnabled: false,
      advancedMode: false,
      templateID: 1,
      projectSearch: "",
      resourceSearch: "",
      projects: [],
      resources: [],
      resourceType: "dataSource",
      filters: null,
      message: JSON.stringify(
        templates.find(t => t.id === 1).templates[0].template,
        undefined,
        2
      ),
      error: "",
      variablesTooltip: false
    },
    watch: {
      type: async function() {
        this.getFilterItems();
        
        if (this.customMessageEnabled && !this.advancedMode) {
          this.updateTemplate();
        }
      },
      templateID: function() {
        this.updateTemplate();
      },
      advancedMode: function() {
        if (!this.advancedMode) this.updateTemplate();
        this.variablesTooltip = false;
      },
      filtersEnabled: function () {
        if(this.filtersEnabled) this.getFilterItems();
      }
    },
    methods: {
      save: function() {
        const webhook = {
          name: this.name,
          type: this.type,
          url: this.url,
          enabled: this.enabled,
          filtersEnabled: this.filtersEnabled,
          filters: this.filters,
          customMessageEnabled: this.customMessageEnabled,
          message: this.message,
          advancedMode: this.advancedMode,
          templateID: this.templateID
        };
        let validInputs = valid(webhook);
        if (validInputs !== true) return (this.error = validInputs);
        saveNewWebhook(webhook);
      },
      deleteWH: function() {
        closeModal("editWebhookModal");
      },
      toggleVariablesTooltip: function () {
        this.variablesTooltip = !this.variablesTooltip;
      },
      updateTemplate: function () {
        const webhookTemplateSet = templates.find(
          t => t.id == this.templateID
        ).templates;
        const webhookTemplate = webhookTemplateSet.find(
          t => t.eventType === this.type
        )
          ? webhookTemplateSet.find(t => t.eventType === this.type).template
          : webhookTemplateSet.find(t => t.eventType === "default").template;
        this.message = JSON.stringify(webhookTemplate, undefined, 2);
      },
      insertMessageText: function (text) {
        const el = document.getElementById("messageText");
        const [start, end] = [el.selectionStart, el.selectionEnd];
        this.message = this.message.substr(0, start) + text + this.message.substr(end);
        el.focus();
        el.selectionStart = start;
      },
      getFilterItems: async function () {
        this.projects = await listResources("project");
        let newResourceType = webhookTypes.find(type => type.name === this.type)
          .resource;
        if (this.filtersEnabled && this.resourceType !== newResourceType)
          this.resources = await listResources(newResourceType);
        this.resourceType = newResourceType;
      }
    },
    created: async function() {
      if (this.filtersEnabled) this.getFilterItems();
    }
  });
}

async function editWebhook(webhookID) {
  showModal("editWebhookModal");
  $("#editModalTitle").html("Edit Webhook");
  const response = await fetch(`/getResource/webhook/${webhookID}`);
  const webhook = await response.json();

  if (webhook.error) return infoModal("error", webhook.error);
  const type = webhookTypes.find(
    type => type.name === Object.keys(webhook["webhook-source"])[0]
  );
  console.log()
  const webhookTemplateSet = templates.find(t => t.id === webhook.templateid).templates;
  const webhookTemplate = webhookTemplateSet.find(t => t.eventType === type.name) ? webhookTemplateSet.find(t => t.eventType === type.name).template : webhookTemplateSet.find(t => t.eventType === "default").template
  const message = webhook.advancedmode
    ? JSON.stringify(webhook.message, undefined, 2)
    : JSON.stringify(webhookTemplate, undefined, 2);
  $("#editWebhookModalBody").html(modalTemplate);

  let editVue = new Vue({
    el: "#editWebhookModalBody",
    data: {
      id: webhook.id,
      name: webhook.name,
      type: type.name,
      url: webhook.routeurl,
      method: webhook["webhook-destination"]["webhook-destination-http"].method,
      enabled: webhook.isEnabled,
      tab: 1,
      filtersEnabled: webhook.filtersenabled,
      customMessageEnabled: webhook.custommessageenabled,
      advancedMode: webhook.advancedmode,
      templateID: webhook.templateid,
      projectSearch: "",
      resourceSearch: "",
      projects: [],
      resources: [],
      resourceType: type.resource,
      filters: webhook.filters,
      message,
      error: "",
      variablesTooltip: false
    },
    watch: {
      type: async function() {
        this.getFilterItems();
        if (this.customMessageEnabled && !this.advancedMode) {
          this.updateTemplate();
        }
      },
      templateID: function() {
        this.updateTemplate();
      },
      advancedMode: function() {
        if (!this.advancedMode) this.updateTemplate();
        this.variablesTooltip = false;
      },
      filtersEnabled: function () {
        if(this.filtersEnabled) this.getFilterItems();
      }
    },
    methods: {
      save: function() {
        const webhook = {
          id: this.id,
          name: this.name,
          type: this.type,
          url: this.url,
          enabled: this.enabled,
          filtersEnabled: this.filtersEnabled,
          filters: this.filters,
          customMessageEnabled: this.customMessageEnabled,
          message: this.message,
          advancedMode: this.advancedMode,
          templateID: this.templateID
        };
        let validInputs = valid(webhook);
        if (validInputs !== true) return (this.error = validInputs);
        console.log("Sent", webhook)
        saveWebhook(webhook);
      },
      deleteWH: function() {
        promptDeleteWebhook(this.id, this.name);
      },
      test: function() {
        testWebhook(this.id);
      },
      toggleVariablesTooltip: function () {
        if (this.advancedMode) this.variablesTooltip = !this.variablesTooltip;
      },
      updateTemplate: function () {
        const webhookTemplateSet = templates.find(
          t => t.id == this.templateID
        ).templates;
        const webhookTemplate = webhookTemplateSet.find(
          t => t.eventType === this.type
        )
          ? webhookTemplateSet.find(t => t.eventType === this.type).template
          : webhookTemplateSet.find(t => t.eventType === "default").template;
        this.message = JSON.stringify(webhookTemplate, undefined, 2);
      },
      insertMessageText: function (text) {
        const el = document.getElementById("messageText");
        const [start, end] = [el.selectionStart, el.selectionEnd];
        this.message = this.message.substr(0, start) + text + this.message.substr(end);
        el.focus();
        el.setSelectionRange(start, start);
      },
      getFilterItems: async function () {
        this.projects = await listResources("project");
        let newResourceType = webhookTypes.find(type => type.name === this.type)
          .resource;
        if (this.filtersEnabled && this.resourceType !== newResourceType)
          this.resources = await listResources(newResourceType);
        this.resourceType = newResourceType;
      }
    },
    created: async function() {
      if (this.filtersEnabled) this.getFilterItems();
    }
  });
}

async function saveWebhook(webhook) {
  showModal("infoModal");
  let response = await updateWebhook(webhook);
  if (response.error) {
    closeModal("infoModal");
    toast("error", response.error);
    return;
  }
  await refreshWebhooksList();
  closeModal("infoModal");
  closeModal("editWebhookModal");
  toast("success", "Webhook updated!");
  // TODO show error in modal?
}

async function saveNewWebhook(webhook) {
  showModal("infoModal");
  let response = await createWebhook(webhook);
  if (response.error) {
    closeModal("infoModal");
    toast("error", response.error);
    return;
  }
  await refreshWebhooksList();
  closeModal("infoModal");
  closeModal("editWebhookModal");
  toast("success", "Webhook created!");
  // TODO show error in modal?
}

function promptDeleteWebhook(webhookID, name) {
  showModal("infoModal");
  $("#infoModalBody").html(`
    <div class="center">
      <p>Delete <b>${name}</b>?</p>
      <div class="row">
        <button class="btn" style="margin-right:5px;" onclick="closeModal('infoModal')">Cancel</button>
        <button class="btn delete" onclick="deleteWebhook('${webhookID}')">Yes, delete</button>
      </div>
    </div>
  `);
}

function valid(webhook) {
  let { url, name, message } = webhook;
  name = name.replace(/[^a-zA-Z0-9 _-]/g, "").trim();
  if (name === "") return "Name cannot be blank.";

  url = url.trim();
  if (url === "") return "URL cannot be blank.";
  const urlrgx = /^(((([A-Za-z]{3,9}:(?:\/\/)?)(?:[\-;:&=\+\$,\w]+@)?[A-Za-z0-9\.\-]+|(?:www\.|[\-;:&=\+\$,\w]+@)[A-Za-z0-9\.\-]+)((?:\/[\+~%\/\.\w\-_]*)?\??(?:[\-\+=&;%@\.\w_]*)#?(?:[\.\!\/\\\w]*))?))$/i;
  if (!urlrgx.test(url)) return "URL is invalid.";
  if (url.substring(0, 5).toLowerCase() !== "https")
    return "URL must be HTTPS.";

  if (parseJson(message) !== true) return parseJson(message);

  return true;
}

function parseJson(txt) {
  context = 10;
  try {
    JSON.parse(txt);
    return true;
  } catch (err) {
    const syntaxErr = err.message.match(/^Unexpected token.*position\s+(\d+)/i);
    const errIdx = syntaxErr
      ? +syntaxErr[1]
      : err.message.match(/^Unexpected end of JSON.*/i)
      ? txt.length - 1
      : null;
    if (errIdx != null) {
      const start = errIdx <= context ? 0 : errIdx - context;
      const end =
        errIdx + context >= txt.length ? txt.length : errIdx + context;
      err.message += ` while parsing near '${
        start === 0 ? "" : "..."
      }${txt.slice(start, end)}${end === txt.length ? "" : "..."}'`;
    } else {
      err.message += ` while parsing '${txt.slice(0, context * 2)}'`;
    }
    return err;
  }
}

function closeModal(modalID) {
  $(`#${modalID}`).css("display", "none");
  $(`#${modalID}Body`).html("");
}

function showModal(modalID) {
  $(`#${modalID}`).css("display", "flex");
  $(`#${modalID}Body`).html(`
    <div class="center">
      <p>Loading please wait...</p>
      <img class="spinner" style="margin: auto" src="https://cdn.glitch.com/f8d1b475-dfd8-4227-a4d2-71691694bbd5%2Fspinner.svg?v=1597706228557" />
    </div>
  `);
}

function info(type, message) {
  $("#webhooksList").html(`<div class="webhook ${type}">${message}</div>`);
}

function infoModal(type, message) {
  $("#editWebhookModalBody").html(
    `<div class="webhook ${type} modal">${message}</div>`
  );
} // TODO add close button

function toast(type, message) {
  $("#toast")
    .css("display", "flex")
    .hide()
    .html(message)
    .addClass(type)
    .fadeIn();

  setTimeout(function() {
    $("#toast")
      .fadeOut()
      .removeClass(type);
  }, 2000);
}

function toggleActionTooltip(id) {
  $(`#action_${id}`).toggleClass('hidden');
}

function takeAction(id, action, e) {
  e.stopPropagation()
  $(`#action_${id}`).addClass('hidden');
  switch (action) {
    case "test":
      testWebhook(id)
      break;
    
    case "delete":
      deleteWebhook(id)
      break;
      
    case "edit":
      editWebhook(id)
      break;
      
    case "duplicate":
      duplicateWebhook(id)
      break;
      
    case "enable":
      toggleWebhook(id, true)
      break;
      
    case "disable":
      toggleWebhook(id, false)
      break;      
  }
  return false
}

Vue.component("list-item", {
  props: ["item", "search", "enabled"],
  template: `
    <label class="modalCheckboxLabel" v-bind:class="{ checked: item.checked, disabled: !enabled }" v-if="search === '' || item.name.toLowerCase().includes(search.toLowerCase())">
      <input type="checkbox" class="modalCheckbox" v-model="item.checked" :disabled="!enabled">
      <div class="modalCheckboxText">{{item.name}}</div>
    </label>
  `
});

// editWebhook("ce476ae5-163f-4db4-9c80-0c89f4ea7d70");