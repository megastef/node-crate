var crate = require('../node-crate');
//crate.usePromiseStyle();
crate.execute ("select * from tweets limit 1").success (function (res){console.log ('Success', res)})
