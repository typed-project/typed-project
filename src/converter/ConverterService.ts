import {PropertyRegistry} from "./PropertyRegistry";
import {PropertyMetadata} from "./PropertyMetadata";
import * as _ from "lodash";
import { isSimpleType } from '../util';
import { Klass } from "../core/Klass";
import { ConvertOptions } from "./ConvertOptions";
import { Component } from "../di";

/**
 * ConverterService used to convert class to object and vice-versa.
 */
@Component()
export class ConverterService {

    public convert(data: any, returnType: Klass, options?: ConvertOptions) {

        if (_.isUndefined(data) || _.isNull(data)) {
            return data;
        }

        const type = data.constructor;
        let properties;

        if (returnType === type) {
            if (typeof options === 'undefined' || typeof options.baseType === 'undefined') {
                return data;
            }
        }


        if (returnType === String) {
            return "" + data;
        }

        if (returnType === Number) {
            return +data;
        }

        if (returnType === Boolean) {
            if (data === 'true') return true;
            if (data === 'false') return false;

            return !!data;
        }

        if (returnType === Date) {
            return new Date(data);
        }

        if (returnType === Array && type === Array && options && options.baseType) {
            return data.map(item => this.convert(item, <Klass>options.baseType));
        }

        if (returnType === Map && type === Map && options && options.baseType) {
            const result = new Map();
            data.forEach((value, key) => {
                result.set(key, this.convert(value, <Klass>options.baseType));
            });
            return result;
        }

        /**
         *
         * Convert class instance to object
         * If provide a converter, and implement serialize function
         * it will use serialize function result as the property value
         *
         */
        properties = PropertyRegistry.properties.get(type);
        if (returnType === Object && !isSimpleType(type) && properties) {

            const result = {};

            properties.forEach((metadata: PropertyMetadata) => {

                if (metadata.serialize === false) return;

                let objectProperty = metadata.objectProperty;

                if (options && options.prefix) {
                    objectProperty = <string> options.prefix + objectProperty;
                }

                let value;

                if (metadata.converter && metadata.converter.serialize) {

                    value = metadata.converter.serialize(data, metadata.klassProperty, metadata.objectProperty);

                } else if (metadata.propertyType === Array || metadata.propertyType === Map) {

                    value = data[metadata.klassProperty];

                    if (isSimpleType(metadata.baseType)) {
                        value = this.convert(value, metadata.propertyType, {baseType: metadata.baseType});
                    } else {
                        value = this.convert(value, metadata.propertyType, {baseType: Object});
                    }

                } else {
                    value = data[metadata.klassProperty];

                    if (isSimpleType(metadata.propertyType)) {
                        value = this.convert(value, metadata.propertyType);
                    } else {
                        value = this.convert(value, Object);
                    }
                }

                result[objectProperty] = value;
            });

            return result;
        }

        /**
         *
         * Convert object to class instance
         * If provide a converter, and implement deserialize function
         * it will use deserialize function result as the property value
         *
         */
        properties = PropertyRegistry.properties.get(returnType);

        if (type === Object && !isSimpleType(returnType) && properties) {

            const klass = <Klass> returnType;
            const ins = new klass();

            properties.forEach((metadata: PropertyMetadata) => {

                if (metadata.deserialize === false) return;

                let objectProperty = metadata.objectProperty;
                if (options && options.prefix) {
                    objectProperty = <string> options.prefix + objectProperty;
                }

                let value;
                if (metadata.converter && metadata.converter.deserialize) {
                    value = metadata.converter.deserialize(data, metadata.klassProperty, objectProperty);
                } else {
                    value = data[objectProperty];
                    value = this.convert(value, metadata.propertyType, {baseType: metadata.baseType});
                }

                ins[metadata.klassProperty] = value;
            });

            return ins;
        }

        /**
         *
         * Convert a class instance to another class instance
         * based on the class property name, convert, ignore converter and serialize and deserialize options
         *
         */
        const returnProperties = PropertyRegistry.properties.get(returnType);
        properties = PropertyRegistry.properties.get(type);
        if (!isSimpleType(type) && !isSimpleType(returnType) && properties && returnProperties) {

            const klass = <Klass> returnType;

            const ins = new klass();

            returnProperties.forEach((metadata: PropertyMetadata) => {
                const value = this.convert(data[metadata.klassProperty], metadata.propertyType, {baseType: metadata.baseType});
                ins[metadata.klassProperty] = value;
            });

            return ins;
        }

        throw `not support convert data`;
    }
}