function privatesquare_pending_init(){

	var pending = privatesquare_deferred_list();

	if (pending.length == 0){
		privatesquare_set_status("There are no pending checkins to administriviate.");

		privatesquare_hide_map();
		$("#pending-form").hide();
		return;
	}

	var prettydate = function(dt){

		var mmToMonth = new Array("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec");

		var yyyy = dt.getFullYear();
		var dd = dt.getDate();
		var mm = mmToMonth[dt.getMonth()];

		/* include time? */
		return mm + " " + dd;
	}

	var html = '<optgroup>';

	for (var i in pending){

		var checkin = pending[i];
		var dt = new Date(checkin['created'] * 1000);

		html += '<option value="' + htmlspecialchars(checkin['id']) + '">';
		html += prettydate(dt) + ' at "';
		html += htmlspecialchars(checkin['venue']);
		html += '"</option>';
	}

	html += '</optgroup>';

	var checkins = $("#checkins");
	checkins.html(html);

	var meh = $("#meh");
	meh.show();    
	meh.click(privatesquare_pending_purge_checkins);

	var deferred = $("#deferred");
	deferred.attr('data-count-pending', pending.length);

	deferred.show();
	deferred.submit(privatesquare_pending_onselect);

	privatesquare_pending_show_map(pending);
}

function privatesquare_pending_onselect(){

	privatesquare_hide_map();

	var deferred = $("#deferred");
	deferred.hide();

	var checkins = $("#checkins");
	var where = checkins.val();

	var checkin = privatesquare_deferred_get_by_id(where);

	var whatnow = $("#whatnow");
	var what = whatnow.val();

	if (what == 'delete'){
		privatesquare_pending_delete_checkin(checkin);
	}

	else {
		privatesquare_pending_fetch_venues(checkin);
	}

	return false;
}

function privatesquare_pending_fetch_venues(checkin){

	var method = 'foursquare.venues.search';

	var args = {
		'query': '"' + checkin['venue'] + '"'
	};

	if ((checkin['latitude']) && (checkin['longitude'])){
		args['latitude'] = checkin['latitude'];
		args['longitude'] = checkin['longitude'];
	}

	else {
		args['near'] =  checkin['near'];
	}

	var on_success = function(rsp){
		rsp['checkin'] = checkin;
		_privatesquare_pending_fetch_venues_onload(rsp);
	};

	privatesquare_api_call(method, args);     
	privatesquare_set_status("Looking for '" + htmlspecialchars(checkin['venue']) + "'");
}

function _privatesquare_pending_fetch_venues_onload(rsp){

	privatesquare_unset_status();

	if (rsp['stat'] != 'ok'){
		privatesquare_api_error(rsp);
		return;
	}

	var count = rsp['venues'].length;

	if (! count){

		var msg = "Ack! foursquare can't find anything like '" + htmlspecialchars(rsp['checkin']['venue']) + "' around those parts.";
		msg += " Also, privatesquare isn't smart enough to deal with this situation yet...";

		privatesquare_set_status(msg);
		return;
	}

	var html = '';
	html += '<optgroup>';

	for (var i=0; i < count; i++){
		var v = rsp['venues'][i];
		html += '<option value="' + v['id'] + '">' + v['name'] + '</option>';
	}

	html += '</optgroup>';

	var where = $("#where");
	where.attr("data-crumb", rsp['crumb']);
	where.attr("data-checkin-id", rsp['checkin']['id']);

	where.html(html);
	
	$("#what").attr("disabled", "disabled");
	$("#broadcast").attr("disabled", "disabled");

	if (rsp['latitude'] && rsp['longitude']){
		privatesquare_show_map(rsp['latitude'], rsp['longitude'], '"' + rsp['checkin']['venue'] + '"');
	}

	else {

		var count_venues = rsp['venues'].length;
		var venues = new Array();

		var swlat = null;
		var swlon = null;
		var nelat = null;
		var nelon = null;

		for (var i=0; i < count_venues; i++){
			var venue = rsp['venues'][i];
			var name = venue['name'];
			var lat = venue['location']['lat'];
			var lon = venue['location']['lng'];

			swlat = (swlat==null) ? lat : Math.min(swlat, lat);
			swlon = (swlon==null) ? lon : Math.min(swlon, lon);
			nelat = (nelat==null) ? lat : Math.max(nelat, lat);
			nelon = (nelon==null) ? lon : Math.max(nelon, lon);

			venues.push([lat, lon, name]);
		}

		var bbox = [swlat, swlon, nelat, nelon];

		privatesquare_show_map_bbox(bbox, venues);
	}

	$("#venues").show();

	var meh = $("#meh");

	meh.click(function(){
		privatesquare_pending_delete_checkin(rsp['checkin']);
	});

	meh.show();

	$("#checkin").submit(_privatesquare_pending_onsubmit);

}

function _privatesquare_pending_onsubmit(){

	var where = $("#where");
	var what = $("#whatnow");

	var id = where.attr("data-checkin-id");
	var checkin = privatesquare_deferred_get_by_id(id);

	if (what.val() == 'delete'){

		var prompt = 'Are you sure you want to delete this pending checkin?';

		if (confirm(prompt)){
			privatesquare_pending_delete_checkin(checkin);
		}

		return false;
	}

	$("#venues").hide();
	$("#meh").hide();

	privatesquare_hide_map();

	var args = privatesquare_gather_args();

	args['created'] = checkin['created'];

	privatesquare_checkin(args, function(rsp){
		rsp['checkin'] = checkin;
		_privatesquare_pending_checkin_onload(rsp);
	});

	privatesquare_set_status("Checking in...");
	return false;
}

function privatesquare_pending_purge_checkins(){

	var q = 'Are you sure you want to delete all those pending checkins?';

	var deferred = $("#deferred");
	var count_pending = deferred.attr('data-count-pending');

	if (count_pending == 1){
		q = 'Are you sure you want to delete all this checkin?';
	}

	if (! confirm(q)){
		return false;
	}

	deferred.hide();

	privatesquare_deferred_purge();
	privatesquare_set_status("Okay all your pending checkins have been deleted.");

	return false;
}

function privatesquare_pending_delete_checkin(checkin){

	var q = "Are you sure you want to delete this pending checkin?";

	if (! confirm(q)){
		return;
	}

	$("#venues").hide();
	$("#meh").hide();

	privatesquare_hide_map()

	privatesquare_deferred_remove(checkin['id']);

	var pending = privatesquare_deferred_list();

	if (pending.length == 0){
		privatesquare_set_status("All your pending checkins have been encheckin-ified (or deleted).");
		return;
	}

	privatesquare_set_status("Your checkin at '" + htmlspecialchars(checkin['venue']) + "' has deleted.");
	privatesquare_pending_init();
}

function _privatesquare_pending_checkin_onload(rsp){

	if (rsp['stat'] != 'ok'){
		privatesquare_api_error(rsp);
		return;
	}

	privatesquare_deferred_remove(rsp['checkin']['id']);

	var pending = privatesquare_deferred_list();

	if (pending.length == 0){
		privatesquare_set_status("All your pending checkins have been encheckin-ified!");
		return;
	}

	privatesquare_set_status("Your checkin at '" + htmlspecialchars(rsp['checkin']['venue']) + "' has been encheckin-ified!");
	privatesquare_pending_init();
}

function privatesquare_pending_show_map(checkins){

	var markers = new Array();

	var swlat = null;
	var swlon = null;
	var nelat = null;
	var nelon = null;

	for (var i in checkins){
		var chk = checkins[i];

		var lat = parseFloat(chk['latitude']);
		var lon = parseFloat(chk['longitude']);

		if ((! lat) || (! lon)){
			continue;
		}

		var latlon = lat + ',' + lon;

		swlat = (swlat == undefined) ? lat : Math.min(swlat, lat);
		swlon = (swlon == undefined) ? lon : Math.min(swlon, lon);
		nelat = (nelat == undefined) ? lat : Math.max(nelat, lat);
		nelon = (nelon == undefined) ? lon : Math.max(nelon, lon);

		var mrk = '<div';
		mrk += ' class="marker marker-header"';
		mrk += ' data-location="' + latlon + '">';
		mrk += '<span class="marker-history-text"></span>';
		mrk += '</div>';

		markers.push(mrk);
	}

	if (markers.length == 0){
		return;
	}

	var wrapper = $("#map-wrapper");

	var map = document.createElement("div");
	map = $(map);

	map.attr("class", "map");

	if (checkins.length == 1){
		var latlon = swlat + ',' + swlon;
		map.attr("data-location", latlon);
		map.attr("data-zoom", 14);
	}

	else {
		var extent = [swlat,swlon,nelat,nelon].join(",");
		map.attr("data-extent", extent);
	}

	map.attr("data-hash", false);
	map.attr("data-touch", true);
	map.attr("data-provider", "toner");

	map.html(markers.join(""));
	wrapper.html(map)

	wrapper.show();

	privatesquare_htmapl(map);	
}
