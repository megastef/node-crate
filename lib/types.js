"use strict";
/* CRATE TYPES
Id's of all currently available data types:
According to https://github.com/crate/crate/blob/9796dbc9104f47a97f7cc8d92e1fa98ae84e93a0/docs/sql/rest.txt#L77

===== ===================
    Id Data Type
===== ===================
    0 Null
----- -------------------
    1 Not Supported
----- -------------------
    2 Byte
----- -------------------
    3 Boolean
----- -------------------
    4 String
----- -------------------
    5 Ip
----- -------------------
    6 Double
----- -------------------
    7 Float
----- -------------------
    8 Short
----- -------------------
    9 Integer
----- -------------------
    10 Long
----- -------------------
    11 Timestamp
----- -------------------
    12 Object
----- -------------------
    13 GeoPoint (Double[])
----- -------------------
    100 Array
----- -------------------
    101 Set
===== ===================
*/
module.exports = {
    NULL:           0,
    NOT_SUPPORTED:  1,
    BYTE:           2,
    BOOLEAN:        3,
    STRING:         4,
    IP:             5,
    DOUBLE:         6,
    FLOAT:          7,
    SHORT:          8,
    INTEGER:        9,
    LONG:           10,
    TIMESTAMP:      11,
    OBJECT:         12,
    GEO_POINT:      13,
    ARRAY:          100,
    SET:            101
};