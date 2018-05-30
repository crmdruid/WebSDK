//====================== Constructor ======================
function WebSDK(url, apiVersion, asyncByDefault) {
    this.sdkUrl = url || Xrm.Page.context.getClientUrl();
    this.apiVersion = apiVersion || parent.APPLICATION_VERSION || "8.2";
    this.asyncByDefault = asyncByDefault;
}

//====================== Query Data ======================

// Retrieves multiple entities using fetchXml - reimplementation of mFetch
WebSDK.prototype.Fetch = function (fetchXml, logicalName, async, successCallback, errorCallback) {
    var batch = new WebSDK.Batch();
    batch.AddRequest(new WebSDK.Request.Fetch(fetchXml, logicalName));
    var req = new WebSDK.Request._batch(batch, this.GetApiUrl());
    //var req = new WebSDK.Request.Fetch(fetchXml, logicalName);
    return this._send(
        {
            request: req,
            async: async,
            onSuccess: successCallback,
            onError: errorCallback,
            isFetch: true
        });
}

// Retrieves a single entity
WebSDK.prototype.Retrieve = function (logicalName, id, columnSet, async, successCallback, errorCallback) {
    return this._send(
        {
            request: new WebSDK.Request.Retrieve(logicalName, id, columnSet),
            async: async,
            onSuccess: successCallback,
            onError: errorCallback
        });
}

// Retrieve multiple implementation, using QueryExpressions
WebSDK.prototype.RetrieveMultiple = function (queryexpression, async, successCallback, errorCallback) {
    return this._send(
        {
            request: new WebSDK.Request.RetrieveMultiple(queryexpression),
            async: async,
            onSuccess: successCallback,
            onError: errorCallback
        });
}

//====================== Create, Update, Delete Operations ======================

/**
* @prop {WebSDK.Entity} entity Entity to create
* @prop {Boolean} async Indicates whether request is to be performed async or sync.
*/
WebSDK.prototype.Create = function (entity, async, successCallback, errorCallback) {
    return this._send(
        {
            request: new WebSDK.Request.Create(entity),
            async: async,
            onSuccess: successCallback,
            onError: errorCallback
        });
}

WebSDK.prototype.Update = function (entity, async, successCallback, errorCallback) {
    return this._send(
        {
            request: new WebSDK.Request.Update(entity),
            async: async,
            onSuccess: successCallback,
            onError: errorCallback
        });
}

WebSDK.prototype.Upsert = function (entity, async, successCallback, errorCallback) {
    return this._send(
        {
            request: new WebSDK.Request.Upsert(entity),
            async: async,
            onSuccess: successCallback,
            onError: errorCallback
        });
}

WebSDK.prototype.Delete = function (logicalName, guid, async, successCallback, errorCallback) {
    return this._send(
        {
            request: new WebSDK.Request.Delete(logicalName, guid),
            async: async,
            onSuccess: successCallback,
            onError: errorCallback
        });
}

//====================== Association Operations ======================

WebSDK.prototype.Associate = function (primaryRecord, relationshipName, relatedRecord, async, successCallback, errorCallback) {
    var sdkUrl = this.GetApiUrl();
    return this._send(
        {
            request: new WebSDK.Request.Associate(primaryRecord, relationshipName, relatedRecord, sdkUrl),
            async: async,
            onSuccess: successCallback,
            onError: errorCallback
        });
}

WebSDK.prototype.Disassociate = function (primaryRecord, relationshipName, relatedRecord, async, successCallback, errorCallback) {
    var sdkUrl = this.GetApiUrl();
    return this._send(
        {
            request: new WebSDK.Request.Disassociate(primaryRecord, relationshipName, relatedRecord, sdkUrl),
            async: async,
            onSuccess: successCallback,
            onError: errorCallback
        });
}

//====================== Function Operations ======================

WebSDK.prototype.Function = function (functionName, parameters, boundOn) {
    return this._send(
        {
            request: new WebSDK.Request.Function(functionName, parameters, boundOn),
            async: async,
            onSuccess: successCallback,
            onError: errorCallback
        });
}

//====================== General Execute Operations ======================

WebSDK.prototype.Execute = function (request, async, successCallback, errorCallback) {
    return this._sendRequest(
        {
            request: request,
            async: async,
            onSuccess: successCallback,
            onError: errorCallback
        });
}

WebSDK.prototype.ExecuteMultiple = function (batch, async, successCallback, errorCallback) {
    if (batch instanceof WebSDK.Batch) {
        return this._send(
            {
                request: batch,
                async: async,
                onSuccess: successCallback,
                onError: errorCallback
            });
    }
    else {
        throw new WebSDK.Error('Invalid Input', 'Only batches can be sent using ExecuteMultiple');
    }
}

//====================== Utility Methods ======================

WebSDK.prototype.GetApiUrl = function () {
    var sdkUrl = this.sdkUrl + "/api/data/v" + this.apiVersion + "/";
    return sdkUrl;
}

//====================== Base Request ======================

/**
* @param {Object} options - { request, async, successCallback, errorCallback }
*
*/
WebSDK.prototype._send = function (options) {
    if (!options.request) {
        throw new WebSDK.Error('Invalid Input', 'No request object specified');
    }
    else {
        if (options.request instanceof WebSDK.Request._base) {
            return this._sendRequest(options);
        }
        else if (options.request instanceof WebSDK.Batch) {
            return this._sendBatch(options)
        }
        else {
            throw new WebSDK.Error('Invalid Input', 'No valid request specified');
        }
    }
}

WebSDK.prototype._sendBatch = function (options) {
    var batch = new WebSDK.Request._batch(options.request, this.GetApiUrl());
    options.request = batch;
    return this._sendRequest(options);
}

WebSDK.prototype._sendRequest = function (options) {
    var async = options.async;
    var successCallback = options.onSuccess;
    var errorCallback = options.onError;
    var request = options.request;

    async = this._resolveAsync(async);

    var req = this._getRequest(request.method, request.endpoint, async, request.headers);

    var isBatchRequest = !!request.formatterParam && request.formatterParam instanceof WebSDK.Batch;

    var body = isBatchRequest ? request.body : JSON.stringify(request.body);

    if (async) {
        if (successCallback || errorCallback) {
            req.onreadystatechange = function () {
                if (this.readyState == 4) {
                    if (this.status == 200 && !!successCallback) { // Success - Content returned
                        if (!isBatchRequest) {
                            var resp = JSON.parse(req.responseText, WebSDK.prototype._dateReviver);

                            if (request.formatter) {
                                resp = request.formatter(resp, request.formatterParam)
                            }

                            successCallback(resp);
                        }
                        else {
                            var resp = new WebSDK.Response.BatchResponse(req, request);
                            var coll = WebSDK._resolveFetchResponse(options, resp);
                            if (coll instanceof WebSDK.Error) {
                                errorCallback(coll);
                            }
                            else {
                                successCallback(coll);
                            }
                        }
                    }
                    else if (this.status == 204 && !!successCallback) { // Success - No content
                        successCallback();
                    }
                    else if (!!errorCallback) {
                        errorCallback(new WebSDK()._getError(req.responseText));
                    }
                }
            }
            req.send(body);
        }
        else if (!!window.Promise) {
            return new Promise(function (resolve, reject) {
                req.onreadystatechange = function () {
                    if (this.readyState == 4) {
                        if (this.status == 200) { // Success - Content returned
                            if (!isBatchRequest) {
                                var resp = JSON.parse(req.responseText, WebSDK.prototype._dateReviver);

                                if (request.formatter) {
                                    resp = request.formatter(resp, request.formatterParam)
                                }

                                resolve(resp);
                            }
                            else {
                                var resp = new WebSDK.Response.BatchResponse(req, request);
                                var coll = WebSDK._resolveFetchResponse(options, resp);
                                if (coll instanceof WebSDK.Error) {
                                    reject(coll);
                                }
                                else {
                                    resolve(coll);
                                }
                            }
                        }
                        else if (this.status == 204) { // Success - No content
                            resolve();
                        }
                        else {
                            reject(new WebSDK()._getError(req.responseText));
                        }
                    }
                }
                req.send(body);
            });
        }
    }
    else {
        try {
            req.send(body);
            if (!isBatchRequest) {
                if (req.status == 204) return;
                var resp = JSON.parse(req.responseText, this._dateReviver);

                if (this._didError(resp)) {
                    throw this._getError(req.responseText);
                }

                if (request.formatter) {
                    resp = request.formatter(resp, request.formatterParam)
                }

                return resp;
            }
            else {
                var resp = new WebSDK.Response.BatchResponse(req, request);
                resp = WebSDK._resolveFetchResponse(options, resp);
                return resp;
            }
        }
        catch (e) { console.error(e); }
    }
}

//====================== Helper Functions ======================

WebSDK.prototype._checkBracesGuid = function (guid) {
    var returnVal = guid;
    if (guid.indexOf("{") == 0) {
        returnVal = guid.substring(1, guid.length - 1);
    }
    return returnVal;
}

/**
* @return {XMLHttpRequest} XHR to WebSDK endpoint.
*
*
*/
WebSDK.prototype._getRequest = function (method, requestString, async, headers) {
    requestUrl = this.GetApiUrl() + requestString;
    var req = new XMLHttpRequest();
    req.open(method, requestUrl, async);

    Object.keys(headers).forEach(function (key) {
        req.setRequestHeader(key, headers[key]);
    });

    return req;
}

// Date reviver for correctly formatting returned JSON
WebSDK.prototype._dateReviver = function (key, value) {
    var a;
    if (typeof value === 'string') {
        a = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*)?)Z$/.exec(value);
        if (a) {
            return new Date(Date.UTC(+a[1], +a[2] - 1, +a[3], +a[4], +a[5], +a[6]));
        }
    }
    return value;
}

WebSDK.ParseEntityCollection = function (collection, logicalName) {
    return WebSDK._formatEntityCollection(collection, logicalName);
}

WebSDK.ParseEntity = function (entity, logicalName) {
    return WebSDK._formatEntity(entity, logicalName);
}

WebSDK._formatFetchResponse = function (response, logicalName) {
    var o = JSON.parse(response.substring(response.indexOf('{'), response.lastIndexOf('}') + 1));
    return WebSDK._formatEntityCollection(o, logicalName);
}

// Formats a retrieved entity collection
WebSDK._formatEntityCollection = function (jsonObject, logicalName) {
    var a = new WebSDK.EntityCollection();

    jsonObject.value.forEach(function (eo) {
        var e = WebSDK._formatEntity(eo, logicalName);
        a.entities.push(e);
    });
    return a;
}

// Formats a retrieved entity
WebSDK._formatEntity = function (entityObject, logicalName) {
    var eln = logicalName;
    var eid = entityObject[eln + "id"];
    var eAtts = new Object(Object.keys(entityObject).length);
    var links = {};
    for (var ea in entityObject) {
        if (entityObject.hasOwnProperty(ea)) {
            if (ea.startsWith("_")) { // lookup value
                if (ea.endsWith("_value")) { // Lookup value, not an odata attribute
                    var attributeName = ea.substring(1, ea.length - 6);
                    var ref = new WebSDK.EntityReference();
                    ref.guid = entityObject[ea];
                    ref.name = entityObject[ea.concat("@OData.Community.Display.V1.FormattedValue")];
                    ref.logicalName = entityObject[ea.concat("@Microsoft.Dynamics.CRM.lookuplogicalname")];
                    eAtts[attributeName] = ref;
                }
            }
            else if (ea.indexOf("_x002e_") != -1) { // is part of linked entity
                var data = ea.split("_x002e_");
                var attName = data[0] + '.' + data[1];
                links[data[0]] = data[1];
                var val = new Object();
                val["value"] = entityObject[ea];

                val["formattedValue"] = null;
                if (!eAtts[attName]) eAtts[attName] = val;
            }
            else { // Other value
                if (!ea.startsWith("@")) { // Handles odata attributes
                    if (!ea.endsWith("@OData.Community.Display.V1.FormattedValue")) {
                        var val = new Object();
                        val["value"] = entityObject[ea];

                        var formattedVal = entityObject[ea.concat("@OData.Community.Display.V1.FormattedValue")]
                        val["formattedValue"] = !!formattedVal ? formattedVal : null;
                        if (!eAtts[ea]) eAtts[ea] = val;
                    }
                }
            }
        }
    }
    var e = new WebSDK.Entity();

    e.attributes = eAtts;
    e.guid = eid;
    e.logicalName = eln;
    return e;
}

// Resolves unspecified async
WebSDK.prototype._resolveAsync = function (async) {
    var resolvedVal = true;
    if (this.asyncByDefault != null) {
        resolvedVal = this.asyncByDefault;
    }

    if (async != null) {
        resolvedVal = async;
    }
    return resolvedVal;
}


// Checks to see if the response is an error, and if so, parses appropriately
WebSDK.prototype._didError = function (response) {
    var didError = false;
    if (response.error != null) {
        didError = true;
    }
    return didError;
}

WebSDK.prototype._getError = function (response) {
    response = JSON.parse(response, WebSDK.prototype._dateReviver);

    var e = this._buildError(response);

    return e;
}

WebSDK.prototype._buildError = function (response) {
    var e = new WebSDK.Error();
    e.message = response.error.message;
    if (response.error.innererror != null) {
        e.type = response.error.innererror.type;
        e.message = response.error.innererror.message ? response.error.innererror.message : e.message;
        e.stackTrace = response.error.innererror.stacktrace;
    }
    if (e.message == null) { e.message = "Error completing operation. Try again, and if this recurs, contact your CRM Administrator."; }

    return e;
}

WebSDK.prototype._getGuid = function () {
    //if (!!crypto) {
    //    return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, function (c) {
    //        return (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    //    });
    //}
    //else {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
    //}
}


WebSDK.prototype._resolveAsyncResponse = function (request, formatter, formatterParam, onSuccess, onError) {
    if (request.readyState == 4) {
        if (request.status == 200) { // Success - Content returned

            var data = JSON.parse(request.responseText, WebSDK.prototype._dateReviver);

            if (!!formatter) {
                data = formatter(data, formatterParam);
            }
            onSuccess(data);
        }
        else if (request.status == 204) { // Success - No content
            onSuccess();
        }
        else {
            onError(new WebSDK()._getError(request.responseText));
        }
    }
}

WebSDK.prototype._resolveSyncResponse = function (responseText, formatter, formatterParam) {

    var resp = JSON.parse(responseText, this._dateReviver);

    if (this._didError(resp)) {
        throw this._getError(responseText);
    }

    if (request.formatter) {
        resp = formatter(resp, formatterParam);
    }

    return resp;
}

WebSDK._resolveFetchResponse = function (options, batchResponse) {
    if (options.isFetch) {
        var resp = batchResponse.retrieveResponses[0];
        var content = resp.content[0];
        return content;
    }
    else {
        return batchResponse;
    }
}

//====================== Primitive Objects ======================

/**
* @param {String} logicalName Logical name of the record
* @param {String} guid Guid of the record
* @param {Object} attributes Attributes of the record
* @prop {String} logicalName Logical name of the record
* @prop {String} guid Guid of the entity
* @prop {Object} attributes Attributes of the record
*/
WebSDK.Entity = function (logicalName, guid, attributes) {
    this.logicalName = logicalName;
    this.guid = guid;
    this.attributes = attributes || {};
}
/**
* @param {String} logicalName Logical name of the record
* @param {String} guid Guid of the record
* @param {String} name Name of the record
* @prop {String} logicalName Logical name of the record
* @prop {String} guid Guid of the record
* @prop {String} name Name of the record
*/
WebSDK.EntityReference = function (logicalName, guid, name, useIsMultiValue) {
    this.logicalName = logicalName;
    this.guid = guid;
    this.name = name || "";
    this.useIsMultiValue = useIsMultiValue || false;
}

/**
* @param {String} type Type of error
* @param {String} message Error Message
* @param {String} stackTrace Error Stacktrace
* @prop {String} type Type of error
* @prop {String} message Error Message
* @prop {String} stackTrace Error Stacktrace
*/
WebSDK.Error = function (type, message, stackTrace) {
    this.type = type;
    this.message = message;
    this.stackTrace = stackTrace;
}

/**
* @param {Array} entities Array of WebSDK.Entity objects
* @prop {Array} entities Array of WebSDK.Entity objects
*/
WebSDK.EntityCollection = function (entities) {
    this.entities = entities || new Array();
}

//====================== Query Objects ======================

/**
* @param {String} entityName Name of the entity to retrieve.
* @prop {WebSDK.ColumnSet} columnset Columns to retrieve for the specified entity. If left blank, just the id is retrieved.
* @prop {WebSDK.FilterExpression} criteria Criteria for the retrieved data. Resolves to an oData query
* @prop {String} entityname Name of the entity to retrieve
* @prop {Integer} count Count of entities to retrieve per page
*/
WebSDK.QueryExpression = function (entityName) {
    this.columnset = new WebSDK.ColumnSet(true);
    this.criteria = new WebSDK.FilterExpression(WebSDK.FilterType.And);
    this.entityname = entityName;
    this.topcount = null;
    this.pagecount = null;
}

WebSDK.QueryExpression.prototype._evaluate = function () {
    var selectString = "";
    var filterString = "";
    var countString = "";
    var queryParameters = new Array();

    var queryString = '';

    var selectPrefix = "$select=";
    var countPrefix = "$top=";
    var filterPrefix = "$filter=";
    var expandPrefix = "$expand=";

    var selectPortion = this.columnset._evaluate();
    if (selectPortion === "") {
        selectPortion = this.entityname + "id";
    }
    if (selectPortion !== true) {
        selectString = selectPrefix + selectPortion;
        queryParameters.push(selectString);
    }

    if (this.count != null) {
        countString = countPrefix + this.count;
        queryParameters.push(countString);
    }

    var filterPortion = this.criteria._evaluate();
    if (filterPortion !== "") {
        filterString = filterPrefix + filterPortion;
        queryParameters.push(filterString);
    }

    if (queryParameters.length > 0) {
        queryString += "?" + queryParameters.join("&");
    }

    return queryString;
}

// Pass in an array of attributes, or true (All attributes). 
WebSDK.ColumnSet = function () {
    this.columns = Array.prototype.slice.call(arguments);
    if (arguments[0] === true) {
        this.columns = true;
    }
}

WebSDK.ColumnSet.prototype._evaluate = function () {
    var cols = true;
    if (Array.isArray(this.columns)) {
        cols = this.columns.join(",");
    }
    return cols;
}

WebSDK.ConditionExpression = function (attribute, comparison, value) {
    this.attribute = attribute;
    this.comparison = comparison;
    this.value = value;
}

WebSDK.ConditionExpression.prototype._evaluate = function () {
    var finalString = "";
    if (typeof (this.value) === 'string') {
        if (this.attribute.startsWith('_') && this.attribute.endsWith('_value')) {
            this.value = WebSDK.prototype._checkBracesGuid(this.value);
        }
        else {
            this.value = "'" + this.value + "'";
        }
    }
    var standardOperators = this._standardOperators();
    var nullOperators = this._nullOperators();
    if (standardOperators.indexOf(this.comparison) != -1) {
        finalString = this.attribute + " " + this.comparison + " " + this.value;
    }
    else if (nullOperators.indexOf(this.comparison) != -1) {
        finalString = this.attribute + " " + this.comparison;
    }
    else {
        finalString = this.comparison + "(" + this.attribute + "," + this.value + ")";
    }
    return finalString;
}

WebSDK.ComparisonOperator = new Object();

WebSDK.ComparisonOperator.Equal = "eq";
WebSDK.ComparisonOperator.NotEqual = "ne";
WebSDK.ComparisonOperator.GreaterThan = "gt";
WebSDK.ComparisonOperator.GreaterOrEqual = "ge";
WebSDK.ComparisonOperator.LessThan = "lt";
WebSDK.ComparisonOperator.LessOrEqual = "le";
WebSDK.ComparisonOperator.Contains = "contains";
WebSDK.ComparisonOperator.EndsWith = "endswith";
WebSDK.ComparisonOperator.StartsWith = "startswith";

WebSDK.ComparisonOperator.Null = WebSDK.ComparisonOperator.Equal + " null";
WebSDK.ComparisonOperator.NotNull = WebSDK.ComparisonOperator.NotEqual + " null";


WebSDK.ConditionExpression.prototype._standardOperators = function () {
    return [
        WebSDK.ComparisonOperator.Equal,
        WebSDK.ComparisonOperator.NotEqual,
        WebSDK.ComparisonOperator.GreaterThan,
        WebSDK.ComparisonOperator.GreaterOrEqual,
        WebSDK.ComparisonOperator.LessThan,
        WebSDK.ComparisonOperator.LessOrEqual,
    ]
};

WebSDK.ConditionExpression.prototype._nullOperators = function () {
    return [
        WebSDK.ComparisonOperator.Null,
        WebSDK.ComparisonOperator.NotNull,
    ]
}

WebSDK.FilterType = new Object();

WebSDK.FilterType.And = "and";
WebSDK.FilterType.Or = "or";

WebSDK.FilterExpression = function (filterType) {
    this.conditions = new Array();
    this.filterType = filterType || WebSDK.FilterType.And;
}

WebSDK.FilterExpression.prototype.AddCondition = function (conditionOrAtt, comparison, value) {

    if (conditionOrAtt instanceof WebSDK.FilterExpression || conditionOrAtt instanceof WebSDK.ConditionExpression) {
        this.conditions.push(conditionOrAtt);
    }
    else {
        var c = new WebSDK.ConditionExpression(conditionOrAtt, comparison, value);
        this.conditions.push(c);
    }
}

WebSDK.FilterExpression.prototype._evaluate = function () {
    var queryString = "";
    if (this.conditions.length > 0) {
        queryString += "(";
        var evaluatedConditions = new Array();
        this.conditions.forEach(function (condition) {
            evaluatedConditions.push(condition._evaluate());
        });

        queryString += evaluatedConditions.join(" " + this.filterType + " ");
        queryString += ")";
    }

    return queryString
}

//====================== Request Objects ======================

WebSDK.Request = {
    headers: {
        "Accept": "application/json",
        "Content-Type": "application/json; charset=utf-8",
        "OData-MaxVersion": "4.0",
        "OData-Version": "4.0"
    },
    executeType: {
        "Action": 1,
        "Function": 2
    },
    _getHeaders: function () {
        var temp;
        if (!!Object.assign) {
            temp = Object.assign({}, WebSDK.Request.headers);
        }
        else {
            temp = JSON.parse(JSON.stringify(WebSDK.Request.headers));
        }

        return temp;
    },
    _getSetNameAsync: function (logicalName) {
        return new Promise(function (resolve, reject) {
            if (!!window.Xrm.Utility) {
                Xrm.Utility.getEntityMetadata(logicalName).then(
                    function success(data) {
                        resolve(data.EntitySetName);
                    },
                    function (error) {
                        reject(error);
                    }
                );
            }
            else {
                resolve(logicalName + 's');
            }
        });
    },
    _getSetName: function (logicalName) {
        var temp = logicalName;
        switch (logicalName.slice(-1)) {
            case 's':
                temp = logicalName + 'es';
                break;
            case 'y':
                temp = logicalName.substring(0, logicalName.length - 1) + 'ies';
                break;
            default:
                temp = logicalName + 's';
                break;
        }

        if (!!window.Xrm && !!window.Xrm.Utility) {
            temp = !!Xrm.Utility.getEntitySetName ? Xrm.Utility.getEntitySetName(logicalName) : temp;
        }
        return temp;
    },
    _resolveBody: function (entity) {
        var body = null;
        if (!!entity) {
            entity = WebSDK.Request._resolveBodyEntityReferences(entity);
            body = entity.attributes;
        }
        return body;
    },
    _resolveBodyEntityReferences: function (entity) {
        Object.keys(entity.attributes).forEach(function (key) {
            if (entity.attributes[key] instanceof WebSDK.EntityReference) {
                var newAttString = entity.attributes[key].useIsMultiValue ? key + '_' + entity.attributes[key].logicalName : key;
                entity.attributes[newAttString + "@odata.bind"] = "/" + WebSDK.Request._getSetName(entity.attributes[key].logicalName) + "(" + entity.attributes[key].guid + ")";
                delete entity.attributes[key];
            }
        });
        return entity;
    },
    _resolveFetchName: function (fetchXml, logicalName) {
        if (logicalName == null) {
            var temp = fetchXml.replace(/"/g, "'");
            temp = temp.substring(fetchXml.indexOf("entity name"));
            temp = temp.substring(temp.indexOf("'") + 1);
            logicalName = temp.substring(0, temp.indexOf("'"));
        }
        return logicalName;
    },
    _resolveFunctionParams: function (params) {
        if (!!params) {
            Object.keys(params).forEach(function (key) {
                if (params[key] instanceof WebSDK.EntityReference) {
                    params[key] = WebSDK.Request._resolveEntityReferenceParam(params[key]);
                }
                else if (params[key] instanceof WebSDK.Entity) {
                    params[key] = WebSDK.Request._resolveEntityParam(params[key]);
                }
                else if (params[key] instanceof WebSDK.EntityCollection) {
                    params[key] = WebSDK.Request._resolveEntityCollectionParam(params[key]);
                }
            });
        }
        return params;
    },
    _resolveEntityReferenceParam: function (entityRef) {
        var logicalName = entityRef.logicalName;
        var guid = entityRef.guid;
        var idName = logicalName + "id";
        var o = {
            "@odata.type": "Microsoft.Dynamics.CRM." + logicalName
        };
        o[idName] = guid;
        return o;
    },
    _resolveEntityParam: function (entity) {
        entity = WebSDK.Request._resolveBodyEntityReferences(entity);
        var logicalName = entity.logicalName;
        var guid = entity.guid;
        var idName = logicalName + "id";
        var o = entity.attributes;
        o["@odata.type"] = "Microsoft.Dynamics.CRM." + logicalName;
        o[idName] = guid;
        return o;
    },
    _resolveEntityCollectionParam: function (coll) {
        var a = [];
        coll.entities.forEach(function (e) {
            a.push(WebSDK.Request._resolveEntityParam(e));
        });
        return a;
    },
    _base: function (method, body, endpoint, headers, formatter, formatterParam) {
        this.method = method;
        this.body = body;
        this.endpoint = endpoint;
        this.headers = headers;
        this.formatter = formatter;
        this.formatterParam = formatterParam;
    },
    Create: function (entity) {
        var endpoint = WebSDK.Request._getSetName(entity.logicalName);
        if (entity.guid != null)
            entity.attributes[entity.logicalName + "id"] = WebSDK.prototype._checkBracesGuid(entity.guid);
        return new WebSDK.Request._base("POST", WebSDK.Request._resolveBody(entity), endpoint, WebSDK.Request._getHeaders());
    },
    Update: function (entity) {
        var endpoint = entity.logicalName + 's' + '(' + WebSDK.prototype._checkBracesGuid(entity.guid) + ')';
        var headers = WebSDK.Request._getHeaders();
        headers["If-Match"] = "*";
        return new WebSDK.Request._base("PATCH", WebSDK.Request._resolveBody(entity), endpoint, headers);
    },
    Upsert: function (entity) {
        var endpoint = WebSDK.Request._getSetName(entity.logicalName) + '(' + WebSDK.prototype._checkBracesGuid(entity.guid) + ')';
        return new WebSDK.Request._base("PATCH", WebSDK.Request._resolveBody(entity), endpoint, WebSDK.Request._getHeaders());
    },
    Delete: function (logicalName, id) {
        var endpoint = WebSDK.Request._getSetName(logicalName) + '(' + WebSDK.prototype._checkBracesGuid(id) + ')';
        return new WebSDK.Request._base("DELETE", {}, endpoint, WebSDK.Request._getHeaders());
    },
    Retrieve: function (logicalName, id, columnSet) {
        var endpoint = WebSDK.Request._getSetName(logicalName) + '(' + WebSDK.prototype._checkBracesGuid(id) + ')';
        columnSet = columnSet || new WebSDK.ColumnSet();
        var columnsetPortion = columnSet._evaluate();
        if (columnsetPortion != true) {
            endpoint += columnsetPortion != "" ? "?$select=" + columnsetPortion : "?$select=" + logicalName + "id";
        }
        var headers = WebSDK.Request._getHeaders();
        headers["Prefer"] = "odata.include-annotations=*";

        return new WebSDK.Request._base("GET", {}, endpoint, headers, WebSDK._formatEntity, logicalName);
    },
    RetrieveMultiple: function (queryExpression) {
        var headers = WebSDK.Request._getHeaders();
        headers["Prefer"] = "odata.include-annotations=*";
        if (queryExpression.pagecount != null) {
            headers["Prefer"] += ",odata.maxpagesize=" + queryExpression.pagecount;
        }

        if (queryExpression instanceof WebSDK.QueryExpression) {
            var endpoint = WebSDK.Request._getSetName(queryExpression.entityname) + queryExpression._evaluate();

            return new WebSDK.Request._base("GET", {}, endpoint, headers, WebSDK._formatEntityCollection, queryExpression.entityname);
        }
        else {
            throw new WebSDK.Error('Invalid Input', 'Input is not a query expression.');
        }
    },
    Fetch: function (fetchXml, logicalName) {
        logicalName = WebSDK.Request._resolveFetchName(fetchXml, logicalName);
        var endpoint = WebSDK.Request._getSetName(logicalName) + '?fetchXml=' + encodeURI(fetchXml);
        var headers = WebSDK.Request._getHeaders();
        headers["Prefer"] = "odata.include-annotations=*";

        //var batch = new WebSDK.Batch();
        //batch.AddRequest(new WebSDK.Request._base("GET", null, endpoint, headers, WebSDK._formatEntityCollection, logicalName));

        //return batch;
        return new WebSDK.Request._base("GET", {}, endpoint, headers, WebSDK._formatEntityCollection, logicalName);
    },
    Action: function (actionName, parameters, boundReference) {
        var endpoint = actionName;
        if (boundReference != null && boundReference instanceof WebSDK.EntityReference) {
            setName = WebSDK.Request._getSetName(boundReference.logicalName);
            endpoint = setName + '(' + boundReference.guid + ')/' + "Microsoft.Dynamics.CRM." + endpoint;
        }
        parameters = WebSDK.Request._resolveFunctionParams(parameters);

        return new WebSDK.Request._base("POST", parameters, endpoint, WebSDK.Request._getHeaders());
    },
    Associate: function (primaryRecord, relationship, relatedRecord, apiUrl) {
        var endpoint = WebSDK.Request._getSetName(primaryRecord.logicalName) + '(' + primaryRecord.guid + ')/' + relationship + '/$ref';
        var body = {
            "@odata.id": apiUrl + WebSDK.Request._getSetName(relatedRecord.logicalName) + '(' + relatedRecord.guid + ')'
        }

        return new WebSDK.Request._base("POST", body, endpoint, WebSDK.Request._getHeaders());
    },
    Disassociate: function (primaryRecord, relationship, relatedRecord, apiUrl) {
        var relatedPortion = apiUrl + WebSDK.Request._getSetName(relatedRecord.logicalName) + '(' + relatedRecord.guid + ')';
        var endpoint = WebSDK.Request._getSetName(primaryRecord.logicalName) + '(' + primaryRecord.guid + ')/' + relationship + '/$ref?$id=' + relatedPortion;

        return new WebSDK.Request._base("DELETE", {}, endpoint, WebSDK.Request._getHeaders());
    },
    ApiRequest: function (method, body, endpoint, headers) {
        return new WebSDK.Request._base(method, body, endpoint, headers);
    },
    Function: function (functionName, parameters, bindOn) {
        var endpoint = "";
        var paramString = "";
        var paramCount = 1;

        if (!!bindOn) {
            endpoint = WebSDK.Request._getSetName(bindOn.logicalName) + '(' + bindOn.guid + ')/Microsoft.Dynamics.CRM.' + functionName + '(';
        }
        else {
            endpoint = functionName + '(';
        }

        parameters.forEach(function (param) {
            var paramId = '@p' + paramCount;
            paramCount++;

            endpoint += paramCount == 1 ? '' : ',';
            endpoint += param.name + '=' + paramId;

            paramString += paramCount == 1 ? '?' : '&';
            paramString += paramId + '=' + param._evaluate();
        });

        return new WebSDK.Request._base("GET", {}, endpoint, WebSDK.Request._getHeaders());
    },
    _batch: function (batch, apiUrl) {
        var endpoint = '$batch';
        var headers = WebSDK.Request._getHeaders();
        headers["Content-Type"] = "multipart/mixed;boundary=" + batch.batchName;
        var body = batch._evaluate(apiUrl);

        return new WebSDK.Request._base("POST", body, endpoint, headers, null, batch);
    }
}

WebSDK.Function = function () {

}

WebSDK.Function.Parameter = function (name, value) {
    this.name = name;
    this.value = value;
}

WebSDK.Function.Parameter.prototype._evaluate = function () {
    var val = this.value;

    if (val instanceof String) {
        val = "'" + val + "'";
    }
    else if (val instanceof WebSDK.EntityReference) {
        val = "{'@odata.bind':'" + WebSDK.Request._getSetName(val.logicalName) + "(" + val.guid + ")'}"
    }

    return val;
}


WebSDK.ChangeSet = function () {
    this.setId = WebSDK.prototype._getGuid();
    this.setName = 'changeset_CHA' + this.setId;

    this.requests = [];
}

WebSDK.ChangeSet.prototype.AddRequest = function (request) {
    if (request instanceof WebSDK.Request._base && request.method != 'GET') {
        this.requests.push(request);
    }
    else {
        throw new WebSDK.Error('Invalid Input', 'Input is not a WebSDK request or is a GET request, which cannot be included in a changeset.');
    }
}

WebSDK.ChangeSet.prototype._evaluate = function (apiUrl, contentId) {
    var data = [];
    var setName = this.setName;

    this.requests.forEach(function (req) {

        data.push('--' + setName);
        data.push('Content-Type:application/http');
        data.push('Content-Transfer-Encoding:binary');
        data.push('Content-ID: ' + contentId);
        data.push('');

        data.push(req.method + ' ' + apiUrl + req.endpoint + ' HTTP/1.1');
        data.push('Content-Type: application/json ;type=entry');
        data.push('');
        data.push(JSON.stringify(req.body));

    });

    data.push('--' + this.setName + '--');

    var payload = data.join('\r\n');

    return payload;
}

WebSDK.Batch = function () {
    this.batchId = WebSDK.prototype._getGuid();
    this.batchName = 'batch_BAT' + this.batchId;

    this.changeSets = [];
    this.requests = [];

    this.boundary = this.batchName;
}

WebSDK.Batch.prototype.AddChangeSet = function (changeset) {
    if (changeset instanceof WebSDK.ChangeSet) {
        this.changeSets.push(changeset);
        this.boundary = this.changeSets[this.changeSets.length - 1].setName
    }
    else {
        throw new WebSDK.Error('Invalid Input', 'Item is not a changeset');
    }
}

WebSDK.Batch.prototype.AddRequest = function (request) {
    if (request instanceof WebSDK.Request._base) {
        if (request.method == 'GET') {
            //if (this.requests.length > 0) {
            //    throw new WebSDK.Error('Already a request in this batch.', 'There can only be one "GET" request per batch');
            //}

            this.requests.push(request);
        }
        else {
            var cs = new WebSDK.ChangeSet();
            cs.AddRequest(request);
            this.AddChangeSet(cs);
            this.boundary = this.changeSets[this.changeSets.length - 1].setName
        }
    }
    else {
        throw new WebSDK.Error('Invalid Input', 'Item is not a WebSDK request');
    }
}

WebSDK.Batch.prototype._evaluate = function (apiUrl) {
    var data = [];
    var batchName = this.batchName
    var contentId = 1;

    if (this.changeSets.length > 0) {
        data.push('--' + this.batchName);
        data.push('Content-Type: multipart/mixed;boundary=' + this.changeSets[0].setName);
        data.push('');

        // Add changeset information to the batch
        this.changeSets.forEach(function (cs) {
            data.push(cs._evaluate(apiUrl, contentId));
            contentId++;
        });
    }

    // Add request information to the batchs
    this.requests.forEach(function (req) {
        data.push('--' + batchName);
        data.push('Content-Type: application/http');
        data.push('Content-Transfer-Encoding:binary');
        data.push('Content-ID: ' + contentId);
        data.push('');

        data.push('GET ' + apiUrl + req.endpoint + ' HTTP/1.1');
        var accept = req.headers['Accept'] ? req.headers['Accept'] : 'application/json';
        data.push('Accept: ' + accept);
        data.push('Content-Type: application/json');
        data.push('OData-Version: 4.0');
        data.push('OData-MaxVersion: 4.0');
        data.push('Prefer: odata.include-annotations=*')
        data.push('');
    });

    data.push('--' + this.batchName + '--');

    var payload = data.join('\r\n');

    return payload;
}

WebSDK.Response = {
    BatchResponse: function (xhr, request) {
        var responseText = xhr.responseText;
        this.retrieveResponses = [];
        this.retrieveResponseErrors = [];
        this.changeResponses = [];
        this.changeResponseErrors = [];

        var responseContentType = xhr.getResponseHeader("Content-Type");
        var batchName = responseContentType.substring(responseContentType.indexOf("boundary=")).replace("boundary=", "");

        // Find the boundaries of the change set in the batch.
        var changeSetBoundaries = responseText.match(/boundary=changesetresponse.*/g);

        for (var i = 0; changeSetBoundaries && i < changeSetBoundaries.length; i++) {
            var changeSetName = changeSetBoundaries[i].replace("boundary=", "");

            // Find all change set responses
            var changeSetRegex = new RegExp("--" + changeSetName + "[\\S\\s]*?(?=--" + changeSetName + ")", "gm");

            var changeSets = responseText.match(changeSetRegex);
            var initialChanges = request.formatterParam.changeSets;

            for (var i = 0; i < changeSets.length; i++) {
                var initialChange = initialChanges[i];

                var changeResponse = WebSDK.Response._buildResponse(changeSets[i], initialChange);

                if (changeResponse.content instanceof WebSDK.Error) {
                    this.changeResponseErrors.push(changeResponse);
                }
                else {
                    this.changeResponses.push(changeResponse);
                }
            }
        }

        var initialRequests = request.formatterParam.requests;
        // Find all batch retrieve responses in responseText
        var batchRegex = new RegExp("--" + batchName + "[\\r\\n]+Content-Type: application\\/http[\\S\\s]*?(?=--" + batchName + ")", "gm");
        var retrieveResponsesRaw = responseText.match(batchRegex);

        for (var j = 0; retrieveResponsesRaw && j < retrieveResponsesRaw.length; j++) {
            var initialRequest = initialRequests[j];
            //var formatter = initialRequest.formatter;
            //var formatterParam = initialRequest.formatterParam;

            var retrieveResponse = WebSDK.Response._buildResponse(retrieveResponsesRaw[j], initialRequest);

            if (retrieveResponse.content instanceof WebSDK.Error) {
                this.retrieveResponseErrors.push(retrieveResponse);
            }
            else {
                this.retrieveResponses.push(retrieveResponse);
            }
        }
    },
    _buildResponse: function (rawData, initialRequest) {
        var body = (/^{[\s\S]*?(?=^}$)^}$/m).exec(rawData);
        var statusRaw = (/^HTTP\/1\.1 ([0-9]{3,3}).*$/m).exec(rawData);

        var status = statusRaw && statusRaw.length > 1 ? statusRaw[1] : null;

        var content = [];

        var finalResponse = new WebSDK.Error('An issue occurred while processing the response.', 'An issue occurred while processing the response. No error was able to be obtained.', rawData);

        if (body) {
            if (body.length == 1) {
                var resp = JSON.parse(body[0]);

                if (!!resp.error) {
                    finalResponse = WebSDK.prototype._buildError(resp);
                }
                else {
                    finalResponse = initialRequest.formatter(resp, initialRequest.formatterParam);
                }
                content.push(finalResponse);
            }
            else if (body.length > 1) {
                for (var i = 0; i < body.length; i++) {
                    var resp = JSON.parse(body[i]);

                    if (!!resp.error) {
                        finalResponse = WebSDK.prototype._buildError(resp);
                    }
                    else {
                        finalResponse = initialRequest[i].formatter(resp, initialRequest.formatterParam[i]);
                    }
                    content.push(finalResponse);
                }
            }
        }

        return new WebSDK.Response._baseResponse(status, content);
    },
    _baseResponse: function (status, content) {
        this.status = status;
        this.content = content;
    }
}
