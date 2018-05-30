# WebSDK
WebAPI Wrapper for Microsoft Dynamics 365. The wrapper aims to achieve similar functionality and experience to using the C# SDK libraries

## Overview
WebSDK is my attempt to make a JavaScript library for working with the Dynamics 365 WebAPI that is easy to use and maintain.

As the aim of the library is ease of use, the functionality is designed to be familiar in that I have tried to mimic as closely as possible the syntax and functionality of the C# SDK Libraries.

## How to?
An instance of the wrapper object must be created before it is able to be used. 
In this, there are a couple of options which can be specified:
+ sdkUrl - the Client URL for the org - something like http://orgname.crm6.dynamics.com
  + Defaults to Xrm.Page.context.getClientUrl()
  + Will need to be set manually if calling from a web resource
+ apiVersion - the version of the api to call
  + By default, tries to get the current api version via an unsupported method, and if this is not available, defaults to 8.2
  + It's good to note that you don't need to be using the latest version of the API. At the time of writing this, versions 8 -> 8.2 of the WebAPI are still available in CRM v9
+ asyncByDefault - Whether the requests by the wrapper are to be performed async by default.
  + If not specified, all requests will be performed async.

```javascript
var sdk = new WebSDK(); // Default options

sdk.sdkUrl = "someURL";
sdk.apiVersion = "9.0";
sdk.asyncByDefault = false;
```
## Request Syntax (CRUD)
There are a number of requests available to perform with very little to no code required to be written. Additionally, it is possible to very quickly create a custom request using the syntax available in the wrapper.

#### Create Requests
Creates a record with the given attributes. If an ID is specified, the record will be created with this ID

```javascript
var acc1 = new WebSDK.Entity("account", "acc10000-0000-0000-0000-000000000000");
acc1.attributes["name"] = "TESTAccount1";
acc1.attributes["description"] = "This is a test account created with the WebSDK library";

sdk.Create(acc1);
```
#### Retrieve Requests
Retrieves the record that is specified by ID. In this case, retrieves the record that was created in the above section.

```javascript
sdk.Retrieve("account", "acc10000-0000-0000-0000-000000000000", new WebSDK.ColumnSet("name", "description"));
```
#### Update Requests
Updates the specified record.

```javascript
acc1.attributes["description"] = "Edited using the WebAPI endpoint";
acc1.attributes["parentaccountid"] = new WebSDK.EntityReference("account", "acc20000-0000-0000-0000-000000000000");
sdk.Update(acc1);
```
#### Retrieve Multiple Requests
Equivalent of the RetrieveMultiple SDK operation.
```javascript
var qe = new WebSDK.QueryExpression();
qe.entityname = "account";
qe.columnset = new WebSDK.ColumnSet(["name", "description"]);
qe.count = 5;

var condition = new WebSDK.ConditionExpression("name", WebSDK.ComparisonOperator.Equal, "TESTAccount1");
var condition2 = new WebSDK.ConditionExpression("description", WebSDK.ComparisonOperator.Contains, "WebSDK library");

var filter = new WebSDK.FilterExpression(WebSDK.FilterType.Or);

filter.AddCondition(condition);
filter.AddCondition(condition2);

qe.criteria.AddCondition(filter);

var coll = sdk.RetrieveMultiple(qe, false);
```
#### Delete Requests
Deletes the record specified by ID.
```javascript
sdk.Delete("account", "acc10000-0000-0000-0000-000000000000");
```

#### Associate Requests
Associates the given records using the given relationship. This association works for both 1:N and N:N relationships. This means that lookups can also be populated using this method.
NOTE: RELATIONSHIP ASSOCIATIONS USING WEBAPI ARE UNIDIRECTIONAL. This means that if you try to associate the records in the wrong direction this may not necessarily work. 
```javascript
var ref1 = new WebSDK.EntityReference("logicalName", "guid");
var ref2 = new WebSDK.EntityReference("logicalName", "guid");
sdk.Associate(ref1, "relationship_name", ref2);
```

#### Disassociate Requests
Disassociates the given records using the given relationship. This disassociation works for both 1:N and N:N relationships.
NOTE: LOOKUPS MUST BE CLEARED USING THIS METHOD. ATTEMPTING TO CLEAR A LOOKUP USING AN UPDATE REQUEST WILL RESULT IN AN ERROR.
NOTE: RELATIONSHIP ASSOCIATIONS USING WEBAPI ARE UNIDIRECTIONAL. This means that if you try to associate the records in the wrong direction this may not necessarily work. 
```javascript
var ref1 = new WebSDK.EntityReference("logicalName", "guid");
var ref2 = new WebSDK.EntityReference("logicalName", "guid");
sdk.Disassociate(ref1, "relationship_name", ref2);
```

### Other available requests
Additionally, there are operations that allow for quickly performing the following actions:
+ Performing actions
+ Executing Batch operations
+ Executing Functions

## Additional info
I've had some issues with the OOTB WebAPI wrapper (Xrm.WebApi. ), in terms of the syntax and functionality available. Some of the main features of my implementation are:

### Synchronous and Asynchronous operations
All operations in the WebSDK library are able to be performed synchronously and asynchronously. Whether an action is performed synchronously or asynchronously is determined by two factors.
1. Whether the asyncByDefault flag is set to true
2. Whether the async mode is set manually on the method

#### Setting flag globally
This can be done when instantiating the object:
```javascript
var sdk = new WebSDK();
sdk.asyncByDefault = false;

OR

var sdk = new WebSDK(apiUrl, version, asyncByDefault);
```
#### Setting flag per operation
Every operation can be performed sync or async based on a setting when executing the operation:
```javascript
sdk.Create(entity, async); // true for async, false for sync
```

#### Async Callbacks
Callbacks for async operations can be set in a few different ways.
1. Using the JavaScript promise functionality -> .then, .catch
    + Note that this can have some issues in IE, as Promises are not supported in IE.
2. Including callbacks in the method call

```javascript
// Via Promises
sdk.Retrieve("account", "acc10000-0000-0000-0000-000000000000", new WebSDK.ColumnSet(["name", "description"]))
  .then(function (record) {
    console.log(record.guid);
  });
// Via callback function
sdk.Retrieve("account", "acc10000-0000-0000-0000-000000000000", new WebSDK.ColumnSet(["name", "description"]), true, successCallback, errorCallback);
```
