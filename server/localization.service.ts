import {Resource} from "i18next";
import * as path from "path";

const i18next = require('i18next');

i18next
    .init({
        fallbackLng: 'en',
        resources: require('fs').readdirSync(path.join(__dirname, 'locales'), {withFileTypes: false}).reduce((resources, locale) => ({
            ...resources,
            [locale.split('.')[0]]: {
                translation: require(path.join(__dirname, 'locales', locale))
            }
        }), {} as Resource)
    })

export class LocalizationService {
    public getLocale(locale: string) {
        debugger;
        return i18next.getFixedT(locale);
    }
}
