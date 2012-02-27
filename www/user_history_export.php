<?php

	include("include/init.php");

	loadlib("privatesquare_checkins");
	loadlib("privatesquare_export");
	loadlib("foursquare_users");

	if (! $GLOBALS['cfg']['enable_feature_export']){
		error_disabled();
	}

	$fsq_id = get_int32("foursquare_id");

	if (! $fsq_id){
		error_404();
	}

	$history_url = "user/{$fsq_id}/history/";
	login_ensure_loggedin($history_url);

	$fsq_user = foursquare_users_get_by_foursquare_id($fsq_id);

	if (! $fsq_user){
		error_404();
	}

	$owner = users_get_by_id($fsq_user['user_id']);
	$GLOBALS['smarty']->assign_by_ref("owner", $owner);

	$is_own = ($owner['id'] == $GLOBALS['cfg']['user']['id']) ? 1 : 0;

	if (! $is_own){
		error_403();
	}

	$format = get_str("format");

	if (! privatesquare_export_is_valid_format($format)){

		$map = privatesquare_export_valid_formats();

		$GLOBALS['smarty']->assign("valid_formats", array_keys($map));
		$GLOBALS['smarty']->display("page_user_history_export.txt");
		exit();
	}

	$export_lib = "privatesquare_export_{$format}";
	$export_func = "privatesquare_export_{$format}";

	loadlib($export_lib);

	$more = array();
		
	if (get_isset('inline')){
		$more['inline'] = 1;
	}

	$rsp = privatesquare_checkins_export_for_user($owner);
	$checkins = $rsp['rows'];

	$fh = privatesquare_export_filehandle();

	call_user_func($export_func, $fh, $checkins, $more);
	exit();

?>