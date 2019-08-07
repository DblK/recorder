# Recorder (CICP Plugin)

This CICP plugin allows you to record and replay query stored by the plugin.  
It should be used with configLoader or equivalent.


# How to use it

## Add it to CICP

Install it to your `plugins` folder, then do not forget to add it while launching the cli: `cicp -o configLoader,recorder`.   

## Require this plugin from another

Simply add the following object in your `package.json`:

```json
"plugin": {
  "consumes": [
    "recorder",
  ],
}
```

## Default values for the configLoader

Here is the general settings for the configLoader plugin.:

```js
{
    "recorder": {
        "speed": "fastest"
    }
}
```

The possible values for speed are:
- lower - Two times lower than the original speed
- lowest - Four times lower than the original speed
- fast - Two times faster than the original speed
- fastest - ASAP
- anything else (Original response time)

## Matching requests

This plugin has a basic built-in matcher for request. However, you can make your own and register it by using the function `registerMatcher(matcher)` given an object which must has the following functions:
 * [findRequest(recordset, request)](#matcher_findRequest)
 * [addRequest(recordset, request)](#matcher_addRequest)
 * [getRequests(recordset)](#matcher_getRequests)
 * [setRequests(recordset, requests)](#matcher_setRequests)

<a name="matcher_findRequest" />

### matcher.findRequest

Match a request with a set of recorded response

__Arguments__

 * recordset (String) - Name of the recordset
 * request (http.Request) - The [http.request](https://nodejs.org/api/http.html#http_class_http_clientrequest) amend with urlParse to split url informations.

__Example__

    this.externalMatcher.findRequest(recordset, request);

<a name="matcher_addRequest" />

### matcher.addRequest

Add a new request inside a recorset

__Arguments__

 * recordset (String) - Name of the recordset
 * request (http.Request) - The [http.request](https://nodejs.org/api/http.html#http_class_http_clientrequest) amend with urlParse to split url informations.

__Example__

    this.externalMatcher.addRequest(recordset, request);

<a name="matcher_getRequests" />

### matcher.getRequests

Get the list of all recorded requests of a recordset

__Arguments__

 * recordset (String) - Name of the recordset

__Example__

    this.externalMatcher.getRequests(recordset);

<a name="matcher_setRequests" />

### matcher.setRequests

Set the list of all recorded requests to do research on

__Arguments__

 * recordset (String) - Name of the recordset
 * requests (http.Request) - The [http.request](https://nodejs.org/api/http.html#http_class_http_clientrequest) amend with urlParse to split url informations.

__Example__

    this.externalMatcher.setRequests(recordset, requests);

# Additional Informations

During the replay phase, if a request is not found, a response will be send with status code `404`.

This module use `DEBUG` so feel free to add `DEBUG=cicp:recorder` to see debug logs.

# License

```
Copyright (c) 2019 Rémy Boulanouar

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:



The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.



THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```