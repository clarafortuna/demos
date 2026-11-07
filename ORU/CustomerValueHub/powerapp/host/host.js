/* Power Apps host for the portal pages, bundled to dist/assets/js/pa-host.js.

   The player keeps the app hidden until the app opens its channel and makes a
   first call; getContext() does both. Pages can then reach Dataverse through
   window.PortalHost, the only way out of the page under the host's CSP
   (connect-src 'none').

   Outside Power Apps (a local file, a plain web server) and in pages framed by
   another portal page, PortalHost stays null and the pages keep their own data. */
import { getContext } from '@microsoft/power-apps/app';
import { getClient } from '@microsoft/power-apps/data';
import { dataSourcesInfo } from '../.power/schemas/appschemas/dataSourcesInfo';

function inPlayer() {
  if (window.parent === window) return false;
  try { return !window.parent.location.href; } catch (e) { return true; }
}

// SDK results carry { success, data, error }; failures become rejections.
const unwrap = r => {
  if (r && r.success === false) throw r.error || new Error('Dataverse call failed');
  return r ? r.data : null;
};

window.PortalHost = null;
if (inPlayer()) {
  const client = getClient(dataSourcesInfo);
  window.PortalHost = {
    context: getContext(),
    list: (table, options) => client.retrieveMultipleRecordsAsync(table, options).then(unwrap),
    create: (table, record) => client.createRecordAsync(table, record).then(unwrap),
    update: (table, id, changes) => client.updateRecordAsync(table, id, changes).then(unwrap),
    // File columns: data is a File, Blob, ArrayBuffer or Uint8Array; a
    // download resolves to the bytes as a Uint8Array.
    uploadFile: (table, id, column, fileName, data) => client.uploadFileToRecord(table, id, column, fileName, data).then(unwrap),
    downloadFile: (table, id, column) => client.downloadFileFromRecord(table, id, column).then(unwrap)
  };
}
