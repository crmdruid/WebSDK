//====================== WebSDK - library for interacting with Dynamics CRM WebAPI ======================
// Author: Dominic Jarvis
// Date: August 2017

//====================== Constructor ======================
function WebSDK(url, apiVersion) {
    this.sdkUrl = url || Xrm.Page.context.getClientUrl();
    this.apiVersion = apiVersion || parent.APPLICATION_VERSION || "8.2";
}

//====================== WebSDK Data ======================

// Retrieves multiple entities using fetchXml - reimplementation of mFetch
WebSDK.prototype.RetrieveMultipleFetch = function (fetchXml, logicalName) {
    try {
        var entitySetName = logicalName + 's';

        // If logical name not passed in (legacy)
        if (logicalName == null) {
            var temp = fetchXml.replace("\"", "'");
            temp = temp.substring(fetchXml.indexOf("entity name"));
            temp = temp.substring(temp.indexOf("'") + 1);
            logicalName = temp.substring(0, temp.indexOf("'"));

            entitySetName = logicalName + 's';
        }

        var req = this._getRequest("GET", entitySetName + "?fetchXml=" + encodeURIComponent(fetchXml), true)
        req.send();

        try {
            var resp = JSON.parse(req.responseText, this._dateReviver);
            if (!this._didError(resp)) {
                var formattedResp = this._formatEntityCollection(resp, logicalName);
                return formattedResp;
            }
        } catch (e) { return null; } // No results
    }
    catch (e) { }
}

// Retrieves a single entity
WebSDK.prototype.Retrieve = function (logicalName, id, columnSet, async, successCallback, errorCallback) {
    async = this._resolveAsync(async);
    var columnsetPortion = columnSet._evaluate();
    var selectPortion = "";
    if (columnsetPortion != true) {
        selectPortion = columnsetPortion != "" ? "?$select=" + columnsetPortion : "?$select=" + logicalName + "id";
    }

    var req = this._getRequest("GET", logicalName + "s(" + id + ")" + selectPortion, async);

    req.onreadystatechange = this._handleStateChangeGeneric(req, successCallback, errorCallback, this._formatEntity, logicalName);

    req.send();

    if (async === false) {
        try {
            var resp = JSON.parse(req.responseText, this._dateReviver);
            if (!this._didError(resp)) {
                var formattedResp = this._formatEntity(resp, logicalName);
                return formattedResp;
            }
            else {
                return this._getError(resp);
            }
        } catch (e) { return null; } // No results
    }
}

// Retrieve multiple implementation, using QueryExpressions
WebSDK.prototype.RetrieveMultiple = function (queryexpression, async, successCallback, errorCallback) {
    async = this._resolveAsync(async);
    //var queryString = encodeURI(queryexpression._evaluate()).replace(new RegExp("''", 'g'), "'");
    var queryString = queryexpression._evaluate();
    var req = this._getRequest("GET", queryString, async);
    var logicalName = queryexpression.entityname;

    req.onreadystatechange = this._handleStateChangeGeneric(req, successCallback, errorCallback, this._formatEntityCollection, logicalName);

    req.send();

    if (async === false) {
        try {
            var resp = JSON.parse(req.responseText, this._dateReviver);
            if (!this._didError(resp)) {
                var formattedResp = this._formatEntityCollection(resp, logicalName);
                return formattedResp;
            }
            else {
                return this._getError(resp);
            }
        } catch (e) { return null; } // No results
    }
}

//====================== Create, Update, Delete Operations ======================

WebSDK.prototype.Create = function (entity, async, successCallback, errorCallback) {
    var req = this._getRequest("POST", entity.logicalName + 's', this._resolveAsync(async));
    if (entity.guid != null) {
        entity.attributes[entity.logicalName + "id"] = entity.guid;
    }
    req.onreadystatechange = this._handleStateChangeGeneric(req, successCallback, errorCallback);
    req.send(JSON.stringify(entity.attributes));
    if (async === false) {
        try {
            var resp = JSON.parse(req.responseText, this._dateReviver);
            return resp;
        }
        catch (e) { return null; }
    }
}

WebSDK.prototype.Update = function (entity, async, successCallback, errorCallback) {
    async = this._resolveAsync(async);
    var req = this._getRequest("PATCH", entity.logicalName + 's(' + entity.guid + ')', this._resolveAsync(async));
    req.setRequestHeader("If-Match", "*");
    req.onreadystatechange = this._handleStateChangeGeneric(req, successCallback, errorCallback);
    req.send(JSON.stringify(entity.attributes));

    if (async === false) {
        try {
            var resp = JSON.parse(req.responseText, this._dateReviver);
            return resp;
        }
        catch (e) { return null; }
    }
}

WebSDK.prototype.Upsert = function (entity, async, successCallback, errorCallback) {
    async = this._resolveAsync(async);
    var req = this._getRequest("PATCH", entity.logicalName + 's(' + entity.guid + ')', this._resolveAsync(async));
    req.onreadystatechange = this._handleStateChangeGeneric(req, successCallback, errorCallback);
    req.send(JSON.stringify(entity.attributes));

    if (async === false) {
        try {
            var resp = JSON.parse(req.responseText, this._dateReviver);
            return resp;
        }
        catch (e) { return null; }
    }
}


WebSDK.prototype.Delete = function (logicalName, guid, async, successCallback, errorCallback) {
    async = this._resolveAsync(async);
    var req = this._getRequest("DELETE", logicalName + 's(' + guid + ')', this._resolveAsync(async));
    req.onreadystatechange = this._handleStateChangeGeneric(req, successCallback, errorCallback);
    req.send();
    if (async === false) {
        try {
            var resp = JSON.parse(req.responseText, this._dateReviver);
            return resp;
        }
        catch (e) { return null; }
    }
}

//====================== WebSDK Objects ======================

WebSDK.QueryExpression = function (entityName) {
    this.columnset = new WebSDK.ColumnSet();
    this.criteria = new WebSDK.FilterExpression(WebSDK.FilterType.And);
    this.entityname = entityName;
    //this.linkentities;
    this.count = 5000;
    //this.pagecount;
}

WebSDK.QueryExpression.prototype._evaluate = function () {
    var selectString = "";
    var filterString = "";
    var countString = "";
    var pageCountString = "";
    var queryParameters = new Array();

    var queryString = this.entityname + "s";

    var selectPrefix = "$select=";
    var countPrefix = "$top=";
    var filterPrefix = "$filter=";

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
WebSDK.ColumnSet = function (columns) {
    this.columns = columns || new Array();
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
        this.value = "'" + this.value + "'";
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


//====================== sdk Objects ======================

WebSDK.Entity = function (logicalName, guid, attributes) {
    this.logicalName = logicalName;
    this.guid = guid;
    this.attributes = attributes || {};
}

WebSDK.EntityReference = function (logicalName, guid) {
    this.logicalName = logicalName;
    this.guid = guid;
}

WebSDK.Error = function (type, message, stackTrace) {
    this.type = type;
    this.message = message;
    this.stackTrace = stackTrace;
}

//====================== Helper Functions ======================

WebSDK.prototype._returnSyncResponse = function (async, req) {

}

WebSDK.prototype._formatActionName = function (name) {
    var actionString = "Microsoft.Dynamics.CRM.";
    if (name.indexOf(actionString) == -1) {
        actionString += name;
    }
    return name;
}

WebSDK.prototype._checkBracesGuid = function (guid) {
    var returnVal = guid;
    if (guid.indexOf("{") == 0) {
        returnVal = guid.substring(1, guid.length - 1);
    }
    return returnVal;
}

// Builds the base request
WebSDK.prototype._getRequest = function (method, requestString, annotations, async) {
    requestUrl = this.sdkUrl + "/api/data/v" + this.apiVersion + "/" + requestString;
    async = async || false;
    var req = new XMLHttpRequest();
    req.open(method, requestUrl, async);
    req.setRequestHeader("Accept", "application/json");
    req.setRequestHeader("Content-Type", "application/json; charset=utf-8");
    req.setRequestHeader("OData-MaxVersion", "4.0");
    req.setRequestHeader("OData-Version", "4.0");
    if (annotations === true) {
        req.setRequestHeader("Prefer", "odata.include-annotations=*");
    }
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

// Formats a retrieved entity collection
WebSDK.prototype._formatEntityCollection = function (jsonObject, logicalName) {
    var a = new Array();

    jsonObject.value.forEach(function (eo) {
        var e = WebSDK.prototype._formatEntity(eo, logicalName);
        a.push(e);
    });
    return a;
}

// Formats a retrieved entity
WebSDK.prototype._formatEntity = function (entityObject, logicalName) {
    var eln = logicalName;
    var eid = entityObject[eln + "id"];
    var eAtts = new Object(Object.keys(entityObject).length);
    for (var ea in entityObject) {
        if (entityObject.hasOwnProperty(ea)) {
            if (ea.startsWith("_")) { // lookup value
                if (ea.endsWith("_value")) { // Lookup value, not an odata attribute
                    var attributeName = ea.substring(1, ea.length - 6);
                    var ref = new Object();
                    ref["guid"] = entityObject[ea];
                    ref["name"] = entityObject[ea.concat("@OData.Community.Display.V1.FormattedValue")];
                    ref["logicalname"] = entityObject[ea.concat("@Microsoft.Dynamics.CRM.lookuplogicalname")];
                    eAtts[attributeName] = ref;
                }
            }
            else { // Other value
                if (!ea.startsWith("@")) { // Handles odata attributes
                    if (!ea.endsWith("@OData.Community.Display.V1.FormattedValue")) {
                        var val = new Object();
                        val["value"] = entityObject[ea];
                        val["formattedValue"] = entityObject[ea.concat("@OData.Community.Display.V1.FormattedValue")];
                        eAtts[ea] = val;
                    }
                }
            }
        }
    }
    var e = new Object();

    e["attributes"] = eAtts;
    e["guid"] = eid;
    e["logicalName"] = eln;
    return e;
}

// Resolves unspecified async
WebSDK.prototype._resolveAsync = function (async) {
    var resolvedVal = false;
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

// Generic error handler
WebSDK.prototype._handleErrorCallback = function (response, errorCallback) {
    if (errorCallback) {
        var e = this._getError(response);
        errorCallback(e.message, e.stacktrace);
    }
}

// Does generic handle state change stuff
WebSDK.prototype._handleStateChangeGeneric = function (req, successCallback, errorCallback, formatter, formatterParam) {
    if (req.readyState == 4 /* complete */) {
        if (req.status == 200) { // Success

            var data = JSON.parse(req.response, WebSDK.prototype._dateReviver);
            if (formatter) {
                data = formatter(data, formatterParam);
            }

            if (successCallback) {
                successCallback(data);
            }
        }
        else {
            WebSDK.prototype._handleErrorCallback(req.response, errorCallback);
        }
    }
}