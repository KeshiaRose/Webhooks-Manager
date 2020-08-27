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

const variables = {
  event_type: "Event Type",
  timestamp: "Timestamp",
  day: "Day",
  time: "Time",
  resource_type: "Resource Type",
  resource_name: "Resource Name",
  resource_id: "Resource ID",
  resource_description: "Resource Description",
  resource_url: "Resource URL",
  resource_created: "Resource Create Time",
  resource_updated: "Resource Last Updated",
  project_name: "Project Name",
  project_id: "Project ID",
  site_id: "Site ID",
  workbook_image: "Workbook Image (Base64)",
};

const templates = [
  {
    id: 1,
    name: "Default",
    templates: [
      {
        eventType: "default",
        template: {
          resource: "{{resource_type}}",
          event_type: "{{event_type}}",
          resource_name: "{{resource_name}}",
          site_luid: "{{site_id}}",
          resource_luid: "{{resource_id}}",
          created_at: "{{timestamp}}"
        }
      }
    ]
  },
  {
    id: 2,
    name: "Slack",
    templates: [
      {
        eventType: "default",
        template: {
          text:
            "{{event_type}} was triggered on {{resource_type}}: {{resource_name}} at {{timestamp}}."
        }
      },
      {
        eventType: "webhook-source-event-datasource-refresh-failed",
        template: {
          text:
            "Data source {{resource_name}} failed to refresh at {{timestamp}}."
        }
      },
      {
        eventType: "webhook-source-event-datasource-refresh-succeeded",
        template: {
          text:
            "Data source {{resource_name}} was refreshed successfully at {{timestamp}}."
        }
      },
      {
        eventType: "webhook-source-event-workbook-updated",
        template: {
          text: "The workbook {{resource_name}} was updated at {{timestamp}}."
        }
      }
    ]
  },
  {
    id: 3,
    name: "Google Hangouts",
    templates: [
      {
        eventType: "default",
        template: {
          text:
            "{{event_type}} was triggered on {{resource_type}}: {{resource_name}} at {{timestamp}}."
        }
      },
      {
        eventType: "webhook-source-event-datasource-refresh-failed",
        template: {
          text:
            "Data source {{resource_name}} failed to refresh at {{timestamp}}."
        }
      },
      {
        eventType: "webhook-source-event-datasource-refresh-succeeded",
        template: {
          text:
            "Data source {{resource_name}} was refreshed successfully at {{timestamp}}."
        }
      },
      {
        eventType: "webhook-source-event-workbook-updated",
        template: {
          text: "The workbook {{resource_name}} was updated at {{timestamp}}."
        }
      }
    ]
  }  
];

const tab1Template = `
<div class="editModal" v-if="tab === 1">
  <div class="row">
    <span class="modalLabel">Webhook Name</span>
    <input class="modalText" placeholder="Cool Webhook" v-model="name"/>
  </div>

  <div class="row">
    <span class="modalLabel">Event Type</span>
    <select class="modalSelect" v-model="type">
      ${webhookTypes.map(
        type => `<option value="${type.name}">${type.label}</option>`
      )}
    </select>
  </div>

  <div class="row">
    <span class="modalLabel">Destination URL</span>
    <input class="modalText" placeholder="https://api.coolservice.com" v-model="url"/>
  </div>

  <div class="row">
    <label class="modalCheckboxLabel" v-bind:class="{ checked: enabled }">
      <input type="checkbox" class="modalCheckbox" v-model="enabled">
      <div class="modalCheckboxText">Webhook enabled</div>
    </label>
  </div>

  <div class="row center" v-if="id">
    <button class="btn" style="width: 200px" v-on:click="test">Test Webhook</button>
  </div>

</div>
`;
const tab2Template = `
<div class="editModal" v-if="tab === 2">

  <div class="row">
    <label class="modalCheckboxLabel" v-bind:class="{ checked: filtersEnabled }">
      <input type="checkbox" class="modalCheckbox" v-model="filtersEnabled">
      <div class="modalCheckboxText">Filtering enabled</div>
    </label>
  </div>

  <div class="rowGroup">
    <div class="listBox" style="margin-right:5px;">
      <input class="modalSearch" placeholder="Search Projects" v-model="projectSearch" :disabled="!filtersEnabled"/>
      <div class="scrolly">
        <list-item v-for="item in projects" v-bind:item="item" v-bind:search="projectSearch" v-bind:enabled="filtersEnabled" v-bind:key="item.id"></list-item>
      </div>
    </div>
    <div class="listBox">
      <input class="modalSearch" placeholder="Search Resources" v-model="resourceSearch" :disabled="!filtersEnabled"/>
      <div class="scrolly">
        <list-item v-for="item in resources" v-bind:item="item" v-bind:search="resourceSearch" v-bind:enabled="filtersEnabled" v-bind:key="item.id"></list-item>
      </div>
    </div>
  </div>

</div>
`;
const tab3Template = `
  <div class="editModal" v-if="tab === 3">
    <div class="row">
      <label class="modalCheckboxLabel" v-bind:class="{ checked: customMessageEnabled }">
        <input type="checkbox" class="modalCheckbox" v-model="customMessageEnabled">
        <div class="modalCheckboxText">Custom message enabled</div>
      </label>
    </div>

    <div class="row">
      <span class="modalLabel">Message Template</span>
      <select class="modalSelect" v-model="templateID" :disabled="!customMessageEnabled || advancedMode" v-bind:class="{ disabled: !customMessageEnabled }">
        ${templates.map(
          template => `<option value="${template.id}">${template.name}</option>`
        )}
      </select>
    </div>

    <div class="row">
      <label class="modalCheckboxLabel" v-bind:class="{ checked: advancedMode, disabled: !customMessageEnabled }" >
        <input type="checkbox" class="modalCheckbox" v-model="advancedMode" :disabled="!customMessageEnabled">
        <div class="modalCheckboxText">Advanced mode enabled</div>
      </label>

      <div class="btn insertBtn" style="margin-left: auto;" v-bind:class="{ disabled: !customMessageEnabled || !advancedMode }" v-on:click="toggleVariablesTooltip">
        Insert variable
        <div class="insertTooltip" v-bind:class="{ hidden: !variablesTooltip }" >
          ${Object.keys(variables).map(v => `<span class="tooltipVariable" v-on:click="this.variablesTooltip = false;insertMessageText('{{${v}}}')">${variables[v]}</span>`).join("")}
        </div>
      </div>
    </div>

    <div class="row" style="height: 100%;margin-top: 0px;">
      <textarea class="modalTextArea" id="messageText" v-bind:class="{ disabled: !customMessageEnabled || !advancedMode }" v-model="message" :disabled="!customMessageEnabled || !advancedMode"></textarea>
    </div>

  </div>
`;
const tab4Template = `
  <div class="editModal" v-if="tab === 4">
    <div class="row" style="height: 350px;overflow-y: auto;overflow-x: hidden;" v-if="id">
      <table>
        <tr>
          <th>Time</th>
          <th>Status</th>
        </tr>
        <tr v-for="h of history">
          <td>{{h.timestamp}}</td>
          <td v-bind:style="{color: h.responsecode.toString().substr(0,1) === '2' ? '#009768' : '#EB4454'}">{{h.responsecode}}</td>
        </tr>
      </table>
    </div>
  </div>
`;
const modalTemplate = `
  <div class="editModal">
    <div class="tabRow">
      <div class="tab" v-bind:class="{ selected: tab === 1 }" v-on:click="tab = 1">SETTINGS</div>
      <div class="tab" v-bind:class="{ selected: tab === 2 }" v-on:click="tab = 2">FILTERS</div>
      <div class="tab" v-bind:class="{ selected: tab === 3 }" v-on:click="tab = 3">MESSAGE</div>
      <div class="tab" v-bind:class="{ selected: tab === 4 }" v-on:click="tab = 4" v-if="id">HISTORY</div>
    </div> 

    ${tab1Template}
    ${tab2Template}
    ${tab3Template}
    ${tab4Template}

    <div class="error">{{error}}</div>
    <div class="modalButtonsRow">
      <button class="btn delete" v-on:click="deleteWH">Delete</button>
      <div>
        <button class="btn" style="margin-right:5px;" onclick="closeModal('editWebhookModal')">Cancel</button>
        <button class="btn primary" v-on:click="save">Save</button>
      </div>
    </div>

  </div>
  `;
