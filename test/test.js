var crate = require('../node-crate');

/*describe('node-crate', function(){
  it('test', function() {

  });
})*/

// this installs .success / .error hooks
crate.usePromiseStyle()
crate.execute ("select * from tweets limit 1").success (function (){console.log ('Suceess')})