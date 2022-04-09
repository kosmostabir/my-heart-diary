import {I18n} from 'i18n';

export class I18nService {

    private i18nProvider: I18n;

    constructor(client) {
         this.i18nProvider = new I18n({
             directory: __dirname + '/locales'
         })
        if (client.locale) {
            this.i18nProvider.setLocale(client.locale);
        }
    }

    t(key, data = {}) {
        return this.i18nProvider.__(key, data);
    }

    getLocale() {
        return this.i18nProvider.getLocale();
    }

    getLocales() {
        return this.i18nProvider.getLocales();
    }
}
