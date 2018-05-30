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
## Request Syntax
There are a number of requests available to perform with very little to no code required to be written. Additionally, it is possible to very quickly create a custom request using the syntax available in the wrapper.

#### Create Requests
```javascript
var acc1 = new WebSDK.Entity("account", "acc10000-0000-0000-0000-000000000000");
acc1.attributes["name"] = "TESTAccount1";
acc1.attributes["description"] = "This is a test account created with the WebSDK library";

sdk.Create(acc1, false);
```

## Additional info
I've had some issues with the OOTB WebAPI wrapper (Xrm.WebAPI. ), in terms of the syntax and functionality available. Some of the main features of my implementation are:

### Synchronous and Asynchronous operations
All operations in the WebSDK library are able to be performed synchronously and asynchronously. 
