function get_lastsubs () {
	try {
		$.getJSON("http://gamingforgood.net/cache/latest.json")
			.done(function (data) {
				var inc = 0, lastsubout = '';
				try {
					var counter = 0;
					$.each(data.subscribers, function(i, object) {	
						counter++;
						if (counter < 11) {
							var subdate = new Date(object.created_at);
							var sublocaltime = subdate.toLocaleTimeString();
							lastsubout = lastsubout + '<tr><td>' + object.placement + '</td><td><a href="http://www.twitch.tv/' + object.name + '" target="_blank">' + object.name + '</a></td><td>' + sublocaltime + '</td></tr>';					
						}				
					});	
					document.getElementById('latestsubs').innerHTML = '<table class="table table-hover table-condensed"><caption><strong style="font-size: 22px;">Latest Subscribers<hr></strong></caption><thead><tr><th></th><th>Name</th><th>When</th></tr></thead><tbody>' + lastsubout + '</tbody></table>';
				}
				catch(err) {
					document.getElementById('latestsubs').innerHTML = '<div class="alert alert-error alert-block"><button type="button" class="close" data-dismiss="alert">&times;</button><strong>Unable to obtain the latest subscribers from twitch, QQ  --  <a href="javascript:get_lastsubs()">Refresh!</a></strong></div>';
				}
			})
			.fail(function() { console.log("Error on last.json request"); });
	}
	catch(err) {
		document.getElementById('latestsubs').innerHTML = '<div class="alert alert-error alert-block"><button type="button" class="close" data-dismiss="alert">&times;</button><strong>- Unable to obtain the latest subscribers from twitch, QQ - <a href="javascript:get_lastsubs()">Refresh!</a></strong></div>';
	}
}
function get_lastjackpot () {
	try {
		$.getJSON("http://gamingforgood.net/cache/ticker.json")
			.done(function (data) {
				var inc = 0, lastsubout = '';
				try {
					lastsubout = '<tr></td><td><a href="http://www.twitch.tv/' + data.last_sub.name + '" target="_blank">' + data.last_sub.name + '</a> is about to win</td><td>' + (data.accumulator - 1) * 2000 + '</td></tr></td><td><a href="http://www.twitch.tv/' + data.last_winner.name + '" target="_blank">' + data.last_winner.name + '</a> just won</td><td>' + data.last_winner.jackpot_points + '</td></tr>							</tr>';					
					document.getElementById('latestjackpot').innerHTML = '<table class="table table-hover table-condensed"><caption><strong>JackPot</strong></caption><thead><tr><th>Name</th><th>Points</th></tr></thead><tbody>' + lastsubout + '</tbody></table>';
				}
				catch(err) {
					document.getElementById('latestjackpot').innerHTML = '<div class="alert alert-error alert-block"><button type="button" class="close" data-dismiss="alert">&times;</button><strong>Unable to obtain the latest JackPot, QQ  --  <a href="javascript:get_lastjackpot()">Refresh!</a></strong></div>';
				}
			})
			.fail(function() { console.log("Error on last.json request"); });
	}
	catch(err) {
		document.getElementById('latestjackpot').innerHTML = '<div class="alert alert-error alert-block"><button type="button" class="close" data-dismiss="alert">&times;</button><strong>- Unable to obtain the latest JackPot, QQ - <a href="javascript:get_lastsubs()">Refresh!</a></strong></div>';
	}
}
function get_hallfame () {
	try {
		$.getJSON("http://gamingforgood.net/cache/leaderboard.json")
			.done(function (data) {
				lastfame = '';
				try {
					$.each(data, function(i, object) {					
							lastfame = lastfame + '<tr><td id="leaderboard-fill">' + (i + 1) + '</td><td><a href="http://www.twitch.tv/' + object.name + '" target="_blank">' + object.name + '</a></td><td><div class="text-center">' + object.accounts + '</div></td></tr>';				
					});	
					document.getElementById('hallfame').innerHTML = '<table class="table table-hover table-condensed"><caption><strong style="font-size: 22px;">Hall of Fame<hr></strong></caption><thead><tr><th></th><th>Name</th><th class="pull-right">Accounts Linked</th></tr></thead><tbody>' + lastfame + '</tbody></table>';
				}
				catch(err) {
					document.getElementById('hallfame').innerHTML = '<div class="alert alert-error alert-block"><button type="button" class="close" data-dismiss="alert">&times;</button><strong>Unable to obtain the hall of fame, QQ  --  <a href="http://gamingforgood.net">Refresh!</a></strong></div>';
				}
			})
			.fail(function() { console.log("Error on request"); });
	}
	catch(err) {
	console.log('errrrr' + err);
		document.getElementById('hallfame').innerHTML = '<div class="alert alert-error alert-block"><button type="button" class="close" data-dismiss="alert">&times;</button><strong>- Unable to obtain the hall of fame, QQ - <a href="http://gamingforgood.net">Refresh!</a></strong></div>';
	}
}

(function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
(i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
})(window,document,'script','//www.google-analytics.com/analytics.js','ga');

ga('create', 'UA-39876679-1', 'gamingforgood.net');
ga('send', 'pageview');



$(document).ready(function () {
	var setintsubs = setInterval(get_lastsubs,30000);
	$('#allwinners').hide();
	$('#faqembed').hide();
	get_lastsubs();
	get_hallfame();
	var gtoggle = '', ftoggle = '', toggle = '', ctoggle = '';
	$("#faqembedclick").click(function() {
		if (ftoggle === 'on') {
			$("#faqembed").hide("slow");
			ftoggle = '';
		}
		else {
			$("#faqembed").show("slow");
			$("#faqembed").attr('tabindex', -1).focus();
			ftoggle = 'on';
		 }
		
	});
	$("#faqembedclickcollapse").click(function() {
		if (ftoggle === 'on') {
			$("#faqembed").hide("slow");
			ftoggle = '';
		}
		else {
			$("#faqembed").show("slow");
			$("#faqembed").attr('tabindex', -1).focus();
			ftoggle = 'on';
		 }
	});
	$("#chatembedclick").click(function() {
		window.open("http://twitch.tv/chat/embed?channel=athenelive&popout_chat=true","_blank","right=50,top=50,width=400,height=600,resizable=yes,scrollbars=no,toolbar=no,location=no,directories=no,status=no,menubar=no,copyhistory=no");
	});
});