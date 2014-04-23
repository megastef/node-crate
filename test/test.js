var crate = require('../node-crate'),
	should = require('should');

crate.connect('localhost', 4200)

describe('#node-crate', function() {
	it('Create table', function(done) {
		crate.execute('CREATE TABLE NodeCrateTest (id integer primary key, title string)')
		.success(function(res) {
				res.rowcount.should.be.exactly(1);
				done();
			})
			.error(function(err) {
				done(err);
			})

	})

	it('Insert', function(done) {

		crate.insert('NodeCrateTest', {
			id: '1',
			title: 'Title'
		})
			.success(function(res) {
				res.rowcount.should.be.exactly(1);
				done();
			})
			.error(function(err) {
				done(err);
			})

	})

	it('Select', function(done) {

		this.timeout(6000);

		setTimeout(function() {
			crate.execute('SELECT * FROM NodeCrateTest limit 100')
				.success(function(res) {
					res.rowcount.should.be.exactly(1);
					done();
				})
				.error(function(err) {
					done(err);
				})
		}, 5000);

	})

	it('Update', function(done) {

		crate.update('NodeCrateTest', {
			title: 'TitleNew'
		}, 'id=1')
			.success(function(res) {

				res.rowcount.should.be.exactly(1);
				done();
			})
			.error(function(err) {
				console.log('err');
				done(err);
			})

	})

	it('Select', function(done) {

		this.timeout(6000);

		setTimeout(function() {
			crate.execute('SELECT * FROM NodeCrateTest limit 100')
				.success(function(res) {
					res.json[0].title.should.be.exactly('TitleNew');
					done();
				})
				.error(function(err) {
					done(err);
				})
		}, 5000);

	})

	it('Delete', function(done) {

		crate.delete('NodeCrateTest', 'id=1')
			.success(function(res) {
				res.rowcount.should.be.exactly(1);
				done();
			})
			.error(function(err) {
				console.log('err');
				done(err);
			})

	})

	it('Delete table', function(done) {

		crate.execute('DROP TABLE NodeCrateTest')
			.success(function(res) {
				res.rowcount.should.be.exactly(1);
				done();
			})
			.error(function(err) {
				done(err);
			})
	})
})
