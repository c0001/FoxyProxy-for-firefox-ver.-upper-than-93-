import {App} from './app.js';

// ---------- Storage Sync ---------------------------------
export class Sync {

  static props = ['proxyDNS', 'passthrough'];

  static init(pref) {
    if (pref.managed) { return; }                           // not for storage.managed

    browser.storage.sync.onChanged.addListener(e => this.onChanged(e));
  }

  static async onChanged(changes) {
    // no newValue on storage.local.clear()
    if (!Object.hasOwn(Object.values(changes)[0] || {}, 'newValue')) { return; }

    const pref = await browser.storage.local.get();
    if (!pref.sync) { return; }

    // convert object to array + filter null newValue (deleted) + map to newValue
    const data = Object.values(changes)
      .filter(i => Object.hasOwn(i.newValue || {}, 'hostname'))
      .map(i => i.newValue);

    const obj = {};
    data[0] && !App.equal(pref.data, data) && (obj.data = data);

    this.props.forEach(item => {
      Object.hasOwn(changes, item) && (obj[item] = changes[item].newValue);
    });

    Object.keys(obj)[0] && browser.storage.local.set(obj);  // update local storage
  }

  static async get(pref) {
    await this.getManaged(pref);                            // check storage.managed
    if (pref.managed) { return; }

    await this.getSync(pref);
  }

  static async getManaged(pref) {
    const result = await browser.storage.managed.get().catch(() => {});
    if (!Array.isArray(result?.data)) {                     // storage.managed not found
      if (Object.hasOwn(pref, 'managed')) {                 // clean up
        delete pref.managed;
        await browser.storage.local.remove('managed');
      }
      return;
    }

    console.log(result);
    const db = App.getDefaultPref();                        // get default pref
    Object.keys(db).forEach(i => pref[i] = db[i]);          // clear pref

    Object.keys(result).forEach(i => Object.hasOwn(pref, i) && (pref[i] = result[i]));  // set data from storage.managed
    pref.managed = true;                                    // set pref.managed to use in options.js
    pref.sync = false;                                      // no sync for storage.managed

    // --- update database
    await browser.storage.local.set(pref);
  }

  static async getSync(pref) {
    if (!pref.sync) { return; }

    const syncPref = await browser.storage.sync.get();

    // convert object to array & filter proxies
    const data = Object.values(syncPref).filter(i => Object.hasOwn(i, 'hostname'));

    const obj = {};
    if (data[0] && !App.equal(pref.data, data)) {
      obj.data = data;
      pref.data = data;
    }

    this.props.forEach(item => {
      if (Object.hasOwn(syncPref, item)) {
        obj[item] = syncPref[item];
        pref[item] = syncPref[item];
      }
    });

    Object.keys(obj)[0] && await browser.storage.local.set({obj}); // update saved pref
  }
}