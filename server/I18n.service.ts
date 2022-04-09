import {I18n} from 'i18n';

export class I18nService {

    private i18nProvider: I18n;

    constructor() {
         this.i18nProvider = new I18n({
             directory: __dirname + '/locales'
         })
    }

    t(key, data = {}) {
        return this.i18nProvider.__(key, data);
    }

    setLocale(locale: string) {
        return this.i18nProvider.setLocale(locale);
    }

    getLocale() {
        return this.i18nProvider.getLocale();
    }

    getLocales() {
        return this.i18nProvider.getLocales();
    }
}
