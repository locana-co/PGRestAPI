/***
**
 * Mock results from DB Call
 * Used for testing result handlers in endpoint functions.
 *
**/


module.exports = {


  //Mock the query to load tables from PostGres Endpoints
  tableList_normal: {
    rows: [
      {table_name: "roads"},
      {table_name: "lakes"},
      {table_name: "rivers"},
      {table_name: "streams"},
      {table_name: "buildings"}
    ]
  },


  //Mock the query to load tables details from PostGres Endpoints
  table_colummnList_normal: {
    rows: [
      "id",
      "oid",
      "count",
      "area",
      "length",
      "name"
    ]
  }

}