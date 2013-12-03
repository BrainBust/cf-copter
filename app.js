// IPcopter 
// Fetches CF DNS Records and compares them vs the full list
// Online/Offline ips added/removed on CF as record based on tcp minecraft packet return
// TCP sockets auto flush after 3 seconds and are destroyed each cycle
// todo: - add latency maximum - module it - add express+helmet for webstats + json private api 

var fs = require('fs'), express = require('express'), app = express(), helmet = require('helmet'), sql = require('mysql'), ping_delay = [], _ = require('underscore'), server_count = -1, os = require('os'), config = require('./config.json'), cloudflare = require('cloudflare').createClient({ email: config.email, token: config.token }), cloudflare_list = [], net = require('mc-ping'),logentries = require('node-logentries'), log = logentries.logger({ token: config.logtoken })
//if appfog data, change config object
if (process.env.VCAP_SERVICES) {
	var env = JSON.parse(process.env.VCAP_SERVICES)
    var dbenv = env['mysql-5.1'][0]['credentials']
	config.db.name = dbenv['name']
	config.db.login = dbenv['username']
	config.db.password = dbenv['password']
	config.db.host = dbenv['host']
	config.db.port = dbenv['port']	
}
//setup sql
var sqlpipe = sql.createConnection({
	host     : config.db.host,
	port     : config.db.port,
	user     : config.db.login,
	password : config.db.password,
	database : config.db.name
})
var remotepipe = sql.createConnection({
	host     : config.dbremote.host,
	port     : config.dbremote.port,
	user     : config.dbremote.login,
	password : config.dbremote.password,
	database : config.dbremote.name
})
//call bootup
bootup(config, sqlpipe, cloudflare, net, _)


app.use(express.compress())

app.use(express.static(__dirname + '/public', { maxAge: config.webmodule.maxage }))
app.use(express.basicAuth(config.webmodule.user, config.webmodule.pass))
app.use(express.methodOverride())
app.use(express.bodyParser())
app.use(helmet.xframe())
app.use(helmet.iexss())
app.use(helmet.contentTypeOptions())
app.use(app.router)
app.configure(function(){
    app.set('views', __dirname + '/views')
    app.set('view engine', 'twig')
    app.set('twig options', { strict_variables: false })
})
app.get('/cloudflare', function(req, res) {
	cloudflare.listDomainRecords(config.domain, function (cloudflarelist_err, records) {
		if (_.isNull(cloudflarelist_err)) { res.render('cloudflare', { servers: config.servers, cf_domain: config.domain, cloudflare: records }) }
		else { log.err(add_server + ' -- Error CF: ' + cloudflarelist_err) }
	})
})
app.post('/cloudflare/remove/:ip', function(req, res) {
	var req_ip = req.params.ip
	cloudflare.listDomainRecords(config.domain, function (cloudflarelist_err, records) {
		if (_.isNull(cloudflarelist_err)) { 
			_.each(records, function (record) {	
				if (record.display_name == config.domain && record.type == 'A' && record.content == req_ip) { 			
					cloudflare.deleteDomainRecord(config.domain, record.rec_id, function (cloudflaredel_err, cloudflaredel_res) { 
						if (!_.isNull(cloudflaredel_err)) { log.err(req_ip + ' -- Webconsole -- Error CF: ' + cloudflaredel_err) }
						else { 
							cloudflare_list.splice(add_server) 
							sqlpipe.query('INSERT INTO CFlogs SET ?', { rec_id: record.rec_id, latency: 0, ip: server, ttl: 120, action: 0 }, function(err, result) {})
							var msg = { message: 'IP added', code: 1 }
							res.json(msg)
						}															
					}) 
				} else { return }		
			})			
		
		}
		else { log.err(add_server + ' -- Error CF: ' + cloudflarelist_err) }
	})
})
app.get('/', function(req, res) {
	var pingmethod = '',boots = '', servers = ''
	if (config.singleping) { pingmethod = 'singleping' }
	else { pingmethod = 'multiping' }
	sqlpipe.query('SELECT * FROM servers WHERE 1 ORDER BY online DESC', function(err, result) {
		if (err) { }
		else {
			servers = result
			sqlpipe.query('SELECT * FROM `bootups` WHERE 1 order by `when` desc limit 5', function(berr, bresult) {	
				if (berr) { }
				else { res.render('index', { servers: servers, config: config, cf_domain: config.domain, lastboots: bresult, pingmethod: pingmethod }) }
			})
		}	
	})
})
app.get('/lookup/:ip', function(req, res) {
	var req_ip = req.params.ip
	sqlpipe.query('SELECT * FROM pings WHERE ip = \'' + req_ip + '\' order by `when` desc', function(berr, bresult) {	
		if (berr) { }
		else { res.render('lookup', { pings: bresult }) }
	})	
})
app.get('/cf/lookup/:ip', function(req, res) {
	var req_ip = req.params.ip
	sqlpipe.query('SELECT * FROM CFlogs WHERE ip = \'' + req_ip + '\' order by `when` desc', function(berr, bresult) {	
		if (berr) { }
		else { res.render('cflogs', { cflogs: bresult }) }
	})	
})
app.post('/addip/:ip', function(req, res) {
	var req_ip = req.params.ip
	sqlpipe.query('SELECT * FROM servers WHERE ip = \'' + req_ip + '\'', function(berr, bresult) {	
		if (berr) { }
		else {	
			if (bresult.length < 1) {
				config.servers.push(req_ip)
				save_json(fs, config, './config')
				sqlpipe.query('TRUNCATE TABLE servers', function(err, result) {})
				sqlpipe.query('ALTER TABLE servers AUTO_INCREMENT = 1', function(err, result) {})
				_.each(config.servers, function (server) { sqlpipe.query('INSERT INTO servers SET ?', { online: 0, latency: 0, ip: server, port: config.port}, function(err, result) {}) })	
				var msg = { message: 'IP added', code: 1 }
				res.json(msg)					
			} else {
				var msg = { message: 'IP already added', code: 0 }
				res.json(msg)	
			}				

		}
	})	
})
app.post('/purge/pings/:days', function (req, res) {
	var req_days = req.params.days
	sqlpipe.query('delete from pings where `when` < DATE_SUB(NOW() , INTERVAL \'' + rec_days + '\' DAY)', function(err, result) {
		if (err) { }
		else { res.json(result) }
	})
})

app.post('/remove/:ip', function(req, res) {
	var req_ip = req.params.ip
	sqlpipe.query('SELECT * FROM servers WHERE ip = \'' + req_ip + '\'', function(berr, bresult) {	
		if (berr) { }
		else {	
			if (bresult.length > 0) {
				config.servers = _.without(config.servers, req_ip)
				save_json(fs, config, './config')
				sqlpipe.query('TRUNCATE TABLE servers', function(err, result) {})
				sqlpipe.query('ALTER TABLE servers AUTO_INCREMENT = 1', function(err, result) {})
				_.each(config.servers, function (server) { sqlpipe.query('INSERT INTO servers SET ?', { online: 0, latency: 0, ip: server, port: config.port}, function(err, result) {}) })	
		
				cloudflare.listDomainRecords(config.domain, function (cloudflarelist_err, records) {
					if (_.isNull(cloudflarelist_err)) { 					
						_.each(records, function (record) {	
							if (record.display_name == config.domain && record.type == 'A' && record.content == req_ip) { 			
								cloudflare.deleteDomainRecord(config.domain, record.rec_id, function (cloudflaredel_err, cloudflaredel_res) { 
									if (!_.isNull(cloudflaredel_err)) { log.err(req_ip + ' -- Webconsole -- Error CF: ' + cloudflaredel_err) }
									else { 
									cloudflare_list.splice(add_server) 
									sqlpipe.query('INSERT INTO CFlogs SET ?', { rec_id: record.rec_id, latency: 0, ip: server, ttl: 120, action: 0 }, function(err, result) {})
									}															
								}) 
							} else { return }		
						})							
					} else { log.err(add_server + ' -- Error CF: ' + cloudflarelist_err) }
				})	
			
				var msg = { message: 'IP ' + req_ip + ' removed', code: 1 }
				res.json(msg)					
			} else {
				var msg = { message: 'IP not found', code: 0 }
				res.json(msg)	
			}				

		}
	})	
})
app.listen(process.env.VCAP_APP_PORT || 25561);



function bootup (config, sqlpipe, cloudflare, net, _) {
	log.info('Booting -- Host: ' + os.hostname() + ' - CPUs: ' + os.cpus().length + ' - Box Uptime: ' + os.uptime() / 3600 + ' Hours')
	sqlpipe.query('TRUNCATE TABLE servers', function(err, result) {})
	sqlpipe.query('ALTER TABLE servers AUTO_INCREMENT = 1', function(err, result) {})
	_.each(config.servers, function (server) { sqlpipe.query('INSERT INTO servers SET ?', { online: 0, latency: 0, ip: server, port: config.port}, function(err, result) {}) })	
	if (config.singleping) { 
		cloudflare.listDomainRecords(config.domain, function (cloudflarelist_err, records) {
			if (!!_.isNull(cloudflarelist_err)) { 					
				_.each(records, function (record) {	
					if (record.display_name == config.domain && record.type == 'A') { cloudflare_list.push(record.content) } 
					else { return }		
				})							
			} else { log.info('Checking CF: ' + cloudflarelist_err) }
		})
		sqlpipe.query('INSERT INTO bootups SET ?', { host: os.hostname(), cpus: os.cpus().length, uptime: os.uptime(), servers: config.servers.length, method: 'singleping' }, function(err, result) {})
		setInterval(ping_server, config.singleping_interval, config, cloudflare, net, _) 
	}
	if (config.multiping) {	
		sqlpipe.query('INSERT INTO bootups SET ?', { host: os.hostname(), cpus: os.cpus().length, uptime: os.uptime(), servers: config.servers.length, method: 'multiping' }, function(err, result) {})
		setInterval(ping_servers, config.multiping_interval, config, cloudflare, net, _) 
	}	
}
function ping_server (config, cloudflare, net, _) {
	server_count = server_count + 1
	ping_delay[config.servers[server_count]] = new Date().getTime()
	var add_server = config.servers[server_count]
	net(add_server, config.port, function(mcping_err, mcping_res) {
		if (_.isNull(mcping_err)) {
			var ping_now = new Date().getTime(), latency = ping_now - ping_delay[add_server]
			sqlpipe.query('INSERT INTO pings SET ?', { ip: add_server, result: 1, latency: latency }, function(err, result) {})			
			sqlpipe.query('UPDATE servers SET ? WHERE ip = \'' + add_server + '\'', { ip: add_server, online: 1, latency: latency }, function(err, result) {})									
			if (!_.contains(cloudflare_list, add_server)) {			
				cloudflare.addDomainRecord(config.domain, { type: "A", name: config.domain, ttl: "120", content: add_server, service_mode: "0" }, function(cloudflareadd_err, cloudflareadd_res) { 
					if (_.isNull(cloudflareadd_err)) { 
						cloudflare.editDomainRecord(config.domain, cloudflareadd_res.rec_id, { type: "A", name: config.domain, ttl: "120", content: add_server, service_mode: "0" }, function(cloudflareedit_err, cloudflareedit_res) { 
							if (!_.isNull(cloudflareedit_err)) { log.err(add_server + ' -- Error CF: ' + cloudflareedit_err) }
							else { 
								cloudflare_list.push(add_server) 
								sqlpipe.query('INSERT INTO CFlogs SET ?', { rec_id: cloudflareadd_res.rec_id, latency: latency, ip: add_server, ttl: 120, action: 1 }, function(err, result) {})
								log.info(add_server + ' -- Domain added to CF')
							}
						})						
					} else { log.err(add_server + ' -- Error CF: ' + cloudflareadd_err) }
				})
			} else { 
				log.info(add_server + ' -- Connect Ok')
				return 
			}
		} else {
			log.err(add_server + ' -- Error IP: ' + mcping_err)	
			sqlpipe.query('INSERT INTO pings SET ?', { ip: add_server, result: 0, latency: 0 }, function(err, result) {})
			sqlpipe.query('UPDATE servers SET ? WHERE ip = \'' + add_server + '\'', { ip: add_server, online: 0, latency: 0 }, function(err, result) {})	
			if (_.contains(cloudflare_list, add_server)) {			
				cloudflare.listDomainRecords(config.domain, function (cloudflarelist_err, records) {
					if (_.isNull(cloudflarelist_err)) { 					
						_.each(records, function (record) {	
							if (record.display_name == config.domain && record.type == 'A' && record.content == add_server) { 			
								cloudflare.deleteDomainRecord(config.domain, record.rec_id, function (cloudflaredel_err, cloudflaredel_res) { 
									if (!_.isNull(cloudflaredel_err)) { log.err(add_server + ' -- Error CF: ' + cloudflaredel_err) }
									else { 
										cloudflare_list.splice(add_server) 
										sqlpipe.query('INSERT INTO CFlogs SET ?', { rec_id: record.rec_id, latency: 0, ip: add_server, ttl: 120, action: 0 }, function(err, result) {})
										log.info(add_server + ' -- Domain removed from CF')
									}															
								}) 
							} else { return }		
						})							
					} else { log.err(add_server + ' -- Error CF: ' + cloudflarelist_err) }
				})	
			}
		}
	})
	if (server_count > (config.servers.length - 2)) { server_count = -1 }
}
function ping_servers (config, cloudflare, net, _) {
	cloudflare_list = []
	ping_delay = []
	
	//get CF DNS records for domain
	cloudflare.listDomainRecords(config.domain, function (cloudflarelist_err, records) {
		if (_.isNull(cloudflarelist_err)) { 
			log.info('CheckingCF - ' + records.length + ' records found .. comparing lists and ping ...')
			
			//loop records and grab the ones on root, async loop and ping them
			_.each(records, function (record) {	
				if (record.display_name == config.domain && record.type == 'A' && _.contains(config.servers, record.content) && !!!_.contains(cloudflare_list, record.content)) { 
					try {	
						ping_delay[record.content] = new Date().getTime()
						net(record.content, config.port, function(mcping_err, mcping_res) {
							if (_.isNull(mcping_err)) {
							
								//got a valid response back, add to compare list
								var ping_now = new Date().getTime()
								var latency = ping_now - ping_delay[record.content]
								log.info('Connect OK - ' + record.content + ' -- Latency - ' + latency + ' ms')		
								cloudflare_list.push(record.content)
								return
								
							} else {	
							
								//error thrown, delete record from cf, do not add to compare list so it gets checked below for a 2nd time this cycle
								log.warning('Connect NO - ' + record.content + ' - Deleting Domain --> ' + mcping_err)	
								cloudflare.deleteDomainRecord(config.domain, record.rec_id, function (cloudflaredel_err, cloudflaredel_res) { }) 
								return		
								
							}
						})			
					} catch (e) { log.err(e) }
				} else { return }		
			})	

			
		 }
		else { log.info('Checking CF: ' + cloudflarelist_err) }
	})
	
	//wait X seconds untill event queue is cleared (depends socket.settimeout)
	//we wait 4 seconds as all pings are forced into error events after 3 seconds allowing 1000ms for the cloudflare lookup above
	setTimeout(function () {
		
		//compare and filter the ips we still need to check, async loop and ping them
		var diff = _.difference(config.servers, cloudflare_list)	
		ping_delay = []	
		log.info('CheckingCF - ' + diff.length + ' IPs not found on CF .. checking ... ')	
		_.each(diff, function(ip) { 
			ping_delay[ip] = new Date().getTime()
			net(ip, config.port, function(mcping_err, mcping_res) {
				if (_.isNull(mcping_err)) {
				
					//welcome back sir proxy sir
					//add to CF as A record + edit domain to set service_mode to 0 
					//(CF removed service_mode from rec_new, so the record wont work without edit after creation)
					var ping_now = new Date().getTime()
					var latency = ping_now - ping_delay[ip]
					log.info('Connect OK - ' + ip + ' -- Latency - ' + latency + ' ms  -- Adding Domain')		
					cloudflare.addDomainRecord(config.domain, { type: "A", name: config.domain, ttl: "120", content: ip, service_mode: "0" }, function(cloudflareadd_err, cloudflareadd_res) { 
						if (_.isNull(cloudflareadd_err)) { 
							cloudflare.editDomainRecord(config.domain, cloudflareadd_res.rec_id, { type: "A", name: config.domain, ttl: "120", content: ip, service_mode: "0" }, function(cloudflareedit_err, cloudflareedit_res) { 
							if (!_.isNull(cloudflareedit_err)) { log.err(cloudflareedit_err) }
							})						
						}
						else { log.info(cloudflareadd_err) }
					}) 					
					return	
					
				} else {
					//log.err('Connect NO - ' + ip + '  --> ' + mcping_err)
				}
			})	
		})
	}, config.eventqueue);
}
function save_json (fs, obj, file) {
	fs.writeFile(__dirname + file + '.json', JSON.stringify(obj, null, 4), function(err) {})
}