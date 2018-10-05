<?php
define('_GAMETITLE', 'GOLD RUN');
if(array_key_exists('action', $_GET)){
	$action = trim(strtolower($_GET['action']));
	switch($action){
		case 'load':
			$level = intval($_POST['level']);
			$result = loadLevel($level);
			if($result){
				echo json_encode($result['map']);
			}
			break;
		case 'settings':
			draw_settings();
			break;
		case 'menu':
			draw_main_menu();
			break;
		case 'lives':
			draw_lives_menu();
			break;
		case 'startinglevel':
			draw_startinglevel_menu();
			break;
		case 'about_1': case 'about_2':
			$parts = explode('_', $action);
			draw_about(intval($parts[1]));
			break;
		default:
			$parts = explode('_', $action);
			if(count($parts) == 2 && $parts[0] == 'help'){
				draw_help($parts[1]);
			}
	}
	exit;
}

if(!function_exists('json_encode')){
	function json_encode($a = false){
		// Some basic debugging to ensure we have something returned
		if (is_null($a)) return 'null';
		if ($a === false) return 'false';
		if ($a === true) return 'true';
		if (is_scalar($a))
		{
			if (is_float($a))
			{
				// Always use "." for floats.
				return floatval(str_replace(",", ".", strval($a)));
			}

			if (is_string($a))
			{
				static $jsonReplaces = array(array("\\", "/", "\n", "\t", "\r", "\b", "\f", '"'), array('\\\\', '\\/', '\\n', '\\t', '\\r', '\\b', '\\f', '\"'));
				return '"' . str_replace($jsonReplaces[0], $jsonReplaces[1], $a) . '"';
			}
			else
				return $a;
		}
		$isList = true;
		for ($i = 0; reset($a); $i++){
			if (key($a) !== $i)
			{
				$isList = false;
				break;
			}
		}
		$result = array();
		if ($isList){
			foreach ($a as $v) $result[] = json_encode($v);
			return '[' . join(',', $result) . ']';
		}
		else
		{
			foreach ($a as $k => $v){
				$result[] = json_encode($k).':'.json_encode($v);
			}
			return '{' . join(',', $result) . '}';
		}
	}
}

function loadLevel($levelNum){
	$levels = loadAllLevels();
	if(array_key_exists($levelNum, $levels)){
		return array(
			'map' => $levels[$levelNum]['data']
		);
	}else{
		return null;
	}
}

function loadAllLevels(){
	$levels = array();
	$fin = fopen('levels.dat', 'r');
	while(!feof($fin)){
		$row = trim(fgets($fin));
		if(strlen($row) > 0){
			$parts = explode('>', $row, 2);
			$levels[] = array('title' => $parts[0], 'data' => $parts[1]);
		}
	}
	fclose($fin);
	return $levels;
}

function draw_menuheader($section = null){
	echo '<div id="mainTitle">';
	echo _GAMETITLE;
	if($section != null){
		echo '<br/>';
		echo '<span class="subheader">' . $section . '</span>';
	}
	echo '</div>';

}
function draw_main_menu(){
?>
	<div>
	<img src="runner.png" style="position:absolute; top:160px; left:320px"/>
	</div>
<?php	draw_menuheader(); ?>
	<div class="menuButton">PLAY</div>
	<div class="menuButton">SETTINGS</div>
	<div class="menuButton">HELP</div>
	<div class="menuButton">ABOUT</div>
	<div class="menuButton">EXIT</div>
<?php
}

function draw_settings(){
	draw_menuheader('SETTINGS');
?>
	<div class="menuButton">CONTROL KEYS</div>
	<div class="menuButton">STARTING LEVEL</div>
	<div class="menuButton">STARTING LIVES</div>
<?/*	<div class="menuButton">THEME</div> */?>
	<div class="menuButton">MAIN MENU</div>
<?php
}

function draw_lives_menu(){
	draw_menuheader('STARTING LIVES');
?>
	<div style="height: 4em"></div>
	<div class="menuButton">5 LIVES</div>
	<div class="menuButton">UNLIMITED</div>
<?php
}

function draw_startinglevel_menu(){
	draw_menuheader('STARTING LEVEL');
?>
	<div style="overflow:hidden; width: 600px; height:17.5em; background-color: #886; margin:auto;">
		<div id="menuScroller" style="position:relative; top:0">
<?php
		$levelDat = loadAllLevels();
		foreach($levelDat as $key => $data){
			echo '<div class="menuButton" id="levelselect_' . $key . '" style="width: 600px;">';
			echo '<div style="display:inline;float:left">' . sprintf("%02d", ($key + 1)) . '</div>';
			echo '<div style="display:inline-block; float:right">' . strtoupper($data['title']) . '</div>';
			echo '</div>';
		}
?>
		</div>
	</div>
	
<?php
}

function draw_about($step){
	switch($step){
		case 1:
			draw_menuheader('ABOUT');
			?>
			<div style="width:85%; margin: auto; text-align:left; font-size: 15px; line-height:16px">
				<p>THIS GAME IS VERY SIMILAR TO THE CLASSIC <a href="http://en.wikipedia.org/wiki/Lode_runner">LODE RUNNER</a>.
				WHEN I WAS A YOUNG LAD IN GRADE SCHOOL, I GOT QUITE HOOKED ON THE GAME
				BUT COULD NOT FIND A COPY OF MY OWN.  INSTEAD, I WROTE MY OWN VERSION OF IT
				AND HAD A WHALE OF A TIME DOING SO.  IT WAS THE FIRST FULL-SIZED GAME I EVER
				WROTE, DONE WITH QUICKBASIC ON A PC RUNNING MS-DOS 3.2</p>
				<p>MORE THAN TWENTY YEARS LATER, IT OCCURRED TO ME THAT THIS SAME GAME COULD BE DONE UP IN JAVASCRIPT
				AND SHARED WITH THE WORLD, AND SO I PRESENT IT TO YOU NOW.</p>
			</div>
			<div class="menuButton" style="display:inline-block">NEXT</div>
			<div class="menuButton" style="display:inline-block">MAIN MENU</div>
			<?php
			break;
		case 2:
			draw_menuheader('ABOUT US');
			?>
			<div style="width:85%; margin: auto; text-align:left; font-size: 15px; line-height:16px">
				<img style="float:right;border:none; margin: 4px;" src="us.png"/>
				<p>WE'RE A HUSBAND AND WIFE TEAM WITH COMPLEMENTARY SKILLS IN
				SOFTWARE DEVELOPMENT AND VISUAL ARTS.  ONE RESULT OF THIS IS THAT WE ENJOY
				CREATING GAMES TOGETHER.  WE INVITE YOU TO TAKE
				A LOOK AT OUR OTHER WORKS ON <a href="http://skilliwags.com">SKILLIWAGS.COM</a></p>
			</div>
			<div class="menuButton" style="display:inline-block; width: 180px;">PREVIOUS</div>
			<div class="menuButton" style="display:inline-block; width: 180px;">MAIN MENU</div>
			<?php
			break;
	}
}

function draw_help($page){
	draw_menuheader('HELP');
	switch($page){
		case 1:?>
			<img src="helpImages/goodguy.png" style="position:absolute; top:415px; left:20px"/>
			<img src="helpImages/gold.png" style="position:absolute; top:415px; left:160px"/>
			<div style="width: 75%; margin:auto; text-align:left">
				<p>GET READY FOR <?=_GAMETITLE?>!</p>
				<p>YOUR GOAL HERE IS TO NAVIGATE EACH LEVEL COLLECTING THE PILES
				OF GOLD FOUND THROUGHOUT.  AFTER YOU HAVE THEM ALL, YOU NEED TO GET TO THE TOP
				OF THE SCREEN TO MOVE ON TO THE NEXT LEVEL.</p>
			</div>
			<div style="text-align:center">
				<div class="menuButton" style="display:inline-block; width: 180px;">NEXT</div>
				<div class="menuButton" style="display:inline-block; width: 180px;">MAIN MENU</div>
			</div>
		<?php	break;
		case 2:?>
			<img src="helpImages/goodguy.png" style="position:absolute; top:415px; left:160px"/>
			<img src="helpImages/badguy.png" style="position:absolute; top:415px; left:520px"/>
			<img src="helpImages/badguy.png" style="position:absolute; top:415px; left:580px"/>
			<img src="helpImages/badguy.png" style="position:absolute; top:415px; left:640px"/>
			<div style="width: 75%; margin:auto; text-align:left">
				<p>AS YOU RUN AROUND COLLECTING GOLD, YOU WILL OFTEN BE CHASED BY BAD GUYS.
				AVOID THEM AT ALL COSTS, AS THEY WILL KILL YOU IMMEDIATELY UPON CONTACT.</p>
			</div>
			<div style="text-align:center">
				<div class="menuButton" style="display:inline-block; width: 180px;">NEXT</div>
				<div class="menuButton" style="display:inline-block; width: 180px;">PREVIOUS</div>
				<div class="menuButton" style="display:inline-block; width: 180px;">MAIN MENU</div>
			</div>

		<?php	break;
		case 3:?>
			<img src="helpImages/goodguy.png" style="position:absolute; top:415px; left:320px"/>
			<img src="helpImages/dissolvingbrick.png" style="position:absolute; top:487px; left:392px"/>
			<img src="helpImages/badguy.png" style="position:absolute; top:487px; left:392px"/>
			<img src="helpImages/badguy.png" style="position:absolute; top:415px; left:580px"/>
			<img src="helpImages/badguy.png" style="position:absolute; top:415px; left:640px"/>
			<div style="width: 75%; margin:auto; text-align:left">
				<p>BECAUSE YOU CAN RUN FASTER THAN THESE VILLAINS, ONE DEFENSE IS TO OUTPACE THEM.  THERE IS
				ANOTHER TRICK UP YOUR SLEEVE THOUGH.  YOU CAN DIG HOLES INTO WHICH THE BAD GUYS
				WILL FALL.  ONCE THEY'RE IN THE HOLE, YOU CAN WALK OVER THEM, SKIPPING THE HOLE YOURSELF.</p>
			</div>
			<div style="text-align:center">
				<div class="menuButton" style="display:inline-block; width: 180px;">NEXT</div>
				<div class="menuButton" style="display:inline-block; width: 180px;">PREVIOUS</div>
				<div class="menuButton" style="display:inline-block; width: 180px;">MAIN MENU</div>
			</div>
		<?php	break;
		case 4:?>
			<img src="helpImages/goodguy.png" style="position:absolute; top:415px; left:320px"/>
			<img src="helpImages/badguy.png" style="position:absolute; top:5px; left:370px"/>
			<img src="helpImages/badguy.png" style="position:absolute; top:415px; left:508px"/>
			<img src="helpImages/badguy.png" style="position:absolute; top:415px; left:568px"/>
			<div style="width: 75%; margin:auto; text-align:left">
				<p>AFTER A CERTAIN AMOUNT OF TIME, ANY HOLES YOU DIG WILL REFILL THEMSELVES AUTOMATICALLY,
				KILLING ANYONE TRAPPED INSIDE.  THAT'S ONLY A TEMPORARY RELIEF THOUGH.  ONCE ONE OF YOUR
				ENEMIES DIE, THEY ARE REINCARNATED AT THE TOP OF THE SCREEN.</p>
			</div>
			<div style="text-align:center">
				<div class="menuButton" style="display:inline-block; width: 180px;">NEXT</div>
				<div class="menuButton" style="display:inline-block; width: 180px;">PREVIOUS</div>
				<div class="menuButton" style="display:inline-block; width: 180px;">MAIN MENU</div>
			</div>
		<?php	break;
		case 5:?>
			<img src="helpImages/brick.png" style="position:absolute; top:390px; left:320px"/>
			<img src="helpImages/steelplate.png" style="position:absolute; top:390px; left:400px"/>
			<div style="width: 75%; margin:auto; text-align:left">
				<p>THERE ARE TWO TYPES OF GROUND MATERIALS THAT YOU WILL FIND YOURSELF WALKING ON,
				BRICKS AND STEEL.  BRICKS ARE THE ONLY MATERIAL INTO WHICH YOU CAN DIG HOLES,
				SO DON'T GET TRAPPED ON A STEEL SURFACE WITHOUT AN ESCAPE ROUTE!</p>
			</div>
			<div style="text-align:center">
				<div class="menuButton" style="display:inline-block; width: 180px;">NEXT</div>
				<div class="menuButton" style="display:inline-block; width: 180px;">PREVIOUS</div>
				<div class="menuButton" style="display:inline-block; width: 180px;">MAIN MENU</div>
			</div>
		<?php	break;
		case 6:?>
			<img src="helpImages/ladder.png" style="position:absolute; top:390px; left:320px"/>
			<img src="helpImages/monkeybar.png" style="position:absolute; top:390px; left:400px"/>
			<div style="width: 75%; margin:auto; text-align:left">
				<p>YOU WILL ALSO SEE LADDERS AND MONKEYBARS THROUGHOUT THE LEVELS.  ON LADDERS,
				YOU CAN MOVE IN ANY DIRECTION YOU WANT.  ON MONKEYBARS, YOU CAN MOVE LEFT OR RIGHT,
				OR YOU CAN LET GO AND FALL TO THE GROUND.</p>
			</div>
			<div style="text-align:center">
				<div class="menuButton" style="display:inline-block; width: 180px;">NEXT</div>
				<div class="menuButton" style="display:inline-block; width: 180px;">PREVIOUS</div>
				<div class="menuButton" style="display:inline-block; width: 180px;">MAIN MENU</div>
			</div>
		<?php	break;
		case 7:?>
			<img src="helpImages/elevators.png" style="position:absolute; top:330px; left:295px"/>
			<div style="width: 75%; margin:auto; text-align:left">
				<p>IN AN ELEVATOR, YOU CAN ONLY MOVE IN THE DIRECTION IT'S GOING, AND THERE'S NO
				EXIT UNTIL YOU REACH THE END OF THE RIDE.</p>
			</div>
			<div style="text-align:center">
				<div class="menuButton" style="display:inline-block; width: 180px;">NEXT</div>
				<div class="menuButton" style="display:inline-block; width: 180px;">PREVIOUS</div>
				<div class="menuButton" style="display:inline-block; width: 180px;">MAIN MENU</div>
			</div>
		<?php	break;
		case 8:?>
			<img src="helpImages/fire.png" style="position:absolute; top:415px; left:100px"/>
			<img src="helpImages/water.png" style="position:absolute; top:415px; left:400px"/>
			<div style="width: 75%; margin:auto; text-align:left">
				<p>WATCH OUT FOR ELEMENTAL PERILS!  YOU WILL IMMEDIATELY BURN OR DROWN IF YOU TRY
				TO NAVIGATE THEM.</p>
			</div>
			<div style="text-align:center">
				<div class="menuButton" style="display:inline-block; width: 180px;">NEXT</div>
				<div class="menuButton" style="display:inline-block; width: 180px;">PREVIOUS</div>
				<div class="menuButton" style="display:inline-block; width: 180px;">MAIN MENU</div>
			</div>
		<?php	break;
		case 9:?>
			<img src="helpImages/spikes.png" style="position:absolute; top:415px; left:295px"/>
			<img src="helpImages/teeth.png" style="position:absolute; top:50px; left:0px"/>
			<div style="width: 75%; margin:auto; text-align:left">
				<p>AS LONG AS THEY'RE OPEN, YOU CAN PASS THROUGH THESE BLADES AND SPIKES THAT STICK
				OUT FROM THE SURFACES AROUND YOU.  JUST DON'T GET CAUGHT WHEN THEY CLAMP SHUT!</p>
			</div>
			<div style="text-align:center">
				<div class="menuButton" style="display:inline-block; width: 180px;">NEXT</div>
				<div class="menuButton" style="display:inline-block; width: 180px;">PREVIOUS</div>
				<div class="menuButton" style="display:inline-block; width: 180px;">MAIN MENU</div>
			</div>
		<?php	break;
		case 10:?>
			<img src="helpImages/hingeplates.png" style="position:absolute; top:350px; left:295px"/>
			<div style="width: 75%; margin:auto; text-align:left">
				<p>THESE TRAP DOOR STEEL PLATES WILL PERIODICALLY FALL OPEN, SENDING THOSE WHO STAND
				ABOVE THEM TO THE PERILS THAT LIE BELOW.</p>
			</div>
			<div style="text-align:center">
				<div class="menuButton" style="display:inline-block; width: 180px;">NEXT</div>
				<div class="menuButton" style="display:inline-block; width: 180px;">PREVIOUS</div>
				<div class="menuButton" style="display:inline-block; width: 180px;">MAIN MENU</div>
			</div>
		<?php	break;
		case 11:?>
			<img src="helpImages/heart.png" style="position:absolute; top:330px; left:350px"/>
			<div style="width: 75%; margin:auto; text-align:left">
				<p>GRAB THESE HEARTS WHEREVER YOU SEE THEM.  THEY PROVIDE AN EXTRA LIFE, WHICH
				MAY GET SPENT QUICKLY.</p>
			</div>
			<div style="text-align:center">
				<div class="menuButton" style="display:inline-block; width: 180px;">NEXT</div>
				<div class="menuButton" style="display:inline-block; width: 180px;">PREVIOUS</div>
				<div class="menuButton" style="display:inline-block; width: 180px;">MAIN MENU</div>
			</div>
		<?php	break;
		case 12:?>
			<img src="helpImages/ice.png" style="position:absolute; top:350px; left:350px"/>
			<div style="width: 75%; margin:auto; text-align:left">
				<p>ICE IS A TRICKY SURFACE TO MANEUVER.  YOU CAN START MOVING ON IT, BUT ONCE YOU
				GET GOING, YOU CAN'T STOP UNTIL YOU REACH THE END.  ALSO, IF YOU DIG A HOLE IN IT,
				IT NEVER COMES BACK.</p>
			</div>
			<div style="text-align:center">
				<div class="menuButton" style="display:inline-block; width: 180px;">NEXT</div>
				<div class="menuButton" style="display:inline-block; width: 180px;">PREVIOUS</div>
				<div class="menuButton" style="display:inline-block; width: 180px;">MAIN MENU</div>
			</div>
		<?php	break;
		case 13:?>
			<img src="helpImages/teleporter.png" style="position:absolute; top:350px; left:350px"/>
			<div style="width: 75%; margin:auto; text-align:left">
				<p>STEP INTO ANY OF THESE TELEPORTERS, AND YOU WILL INSTANTLY APPEAR IN THE NEXT
				AVAILABLE ONE.</p>
			</div>
			<div style="text-align:center">
				<!--div class="menuButton" style="display:inline-block; width: 180px;">NEXT</div-->
				<div class="menuButton" style="display:inline-block; width: 180px;">PREVIOUS</div>
				<div class="menuButton" style="display:inline-block; width: 180px;">MAIN MENU</div>
			</div>
		<?php	break;
	}
	?>
	<?php
}
?>

<!DOCTYPE html>
<html>
<head>
	<link href='http://fonts.googleapis.com/css?family=Press+Start+2P&subset=latin,latin-ext' rel='stylesheet' type='text/css'>
	<style type="text/css">
		body{
			text-align:center;
			background-color: #111;
			color: #FFC;
			font-family: 'Press Start 2P', cursive;
			font-size: 16px;
		}
		a{
			text-decoration:none;
			color: #CB9;
		}
		#menuWrapper{
			width: 80%;
			height: 80%;
			text-align: center;
			background-color: #000;
			position: absolute;
			top: 10%;
			left: 10%;
			border: 2px solid #CCB;
		}
		#mainTitle{
			margin:auto;
			height: 140px;
			margin-top: 40px;
			font-size: 48px;
		}
		.subheader{
			font-size: 24px;
		}
		div.menuButton{
			margin:auto;
			width: 300px;
			height: 2.5em;
			line-height: 2.5em;
			text-align:center;
			position:relative;
		}
		#pageWrapper{
			top:60px;
			position:relative;
			margin:auto;
			width: 960px;
			height: 610px;
			background-color: #000;
			border: 3px solid #444;
			overflow: hidden;
		}
		#gameWrapper{
			position:absolute;
			top: 0px;
			left: 0px;
			width: 100%;
			height: 100%;
		}
		#landingPage{
			position:absolute;
			top: 0px;
			left: 0px;
			width: 100%;
			height: 100%;
			background: url(brickTexture.gif);
			text-align:center;
		}
		#gameOverlay{
			position: absolute;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
		}
		#gameCanvas{
			position: relative;
			overflow: hidden;
			top: 0;
			left: 0;
			width: 100%;
			height: 576px;
			border-bottom: 2px solid #444;
		}
		#gameFooter{
			position:relative;
			text-align: left;
			height: 30px;
			line-height: 30px;
			background-color: #000;
		}

		#lives{
			/*width: 220px;*/
			display: inline;
			min-width: 220px;
			text-align: left;
			float: right;
		}
		.footerContent{
			padding-top: 5px;
		}

	</style>
	<script src="http://ajax.googleapis.com/ajax/libs/jquery/1.5/jquery.min.js"></script>
	<script type="text/javascript" src="spriteSet.js"></script>
	<script type="text/javascript" src="goldRun.js"></script>
	<script src="http://www.google-analytics.com/urchin.js" type="text/javascript"></script>
	<script type="text/javascript">
	_uacct = "UA-3072147-1";
	try{urchinTracker();}catch(e){};
	var lastMenuSelect = 0, menuOptions = [];
	var section_content = {};
	var startingLevel = <?=intval($_GET['level'])?>;
	$(document).ready(function(){
		$(document).keydown(keydownCall);
		$(document).keyup(keyupCall);
		gameState = 'menu';
		buildMenu();
		menuSelect(menuOptions[0]);
		section_content['menu'] = $('#menuWrapper').html();
	});
	function handleKey(code, state){
		keyState[code] = state ? 1 : 0;
		if(state == 1){
			switch(gameState){
				case 'ready':
					player.sprite.stopSequence();	
					startPlay();
					// note the intentional lack of a break;
				case 'playing':
					handle_playkey(code);
					break;
				case 'menu': case 'settings': case 'controls': case 'lives': case 'about_1': case 'about_2':
					handle_menuKey(code);
					break;
				case 'startinglevel':
					handle_startinglevel_key(code);
					break;
				case 'getkey':
					handle_key_select(code);
					break;
				case 'help_1': case 'help_2': case 'help_3': case 'help_4':
				case 'help_5': case 'help_6': case 'help_7': case 'help_8':
				case 'help_9': case 'help_10': case 'help_11': case 'help_12':
				case 'help_13':
					handle_help_key(code);
					break;
			}
		}
	}

	function handle_help_key(code){
		switch(code){
			case KEYMAP.ENTER:
			case KEYMAP.SPACE:
				var text = menuOptions[lastMenuSelect].text();
				if(menuAction[text] != undefined){
					// it's a standard menu option
					menuAction[text]();
				}else{
					switch(text){
						case 'NEXT':
							var currentStep = 1 * gameState.split('_')[1] + 1;
							gameState = 'help_' + currentStep;
							loadSection(gameState);
							break;
						case 'PREVIOUS':
							var currentStep = 1 * gameState.split('_')[1] - 1;
							gameState = 'help_' + currentStep;
							loadSection(gameState);
							break;
					}
				}
				break;
			case KEYMAP.ESC:
				gameState = 'menu';
				loadSection(gameState);
				break;
			case KEYMAP.LEFT:
			case KEYMAP.UP:
				if(lastMenuSelect > 0){
					menuSelect(menuOptions[lastMenuSelect - 1]);
				}
				break;
			case KEYMAP.RIGHT:
			case KEYMAP.DOWN:
				if(lastMenuSelect < menuOptions.length - 1){
					menuSelect(menuOptions[lastMenuSelect + 1]);
				}
				break;
		}
	}

	function handle_menuKey(code){
		switch(code){
			case KEYMAP.UP:
				if(lastMenuSelect > 0){
					menuSelect(menuOptions[lastMenuSelect - 1]);
				}
				break;
			case KEYMAP.DOWN:
				if(lastMenuSelect < menuOptions.length - 1){
					menuSelect(menuOptions[lastMenuSelect + 1]);
				}
				break;
			case KEYMAP.ENTER:
			case KEYMAP.SPACE:
				var text = menuOptions[lastMenuSelect].text();
				if(menuAction[text] != undefined){
					// it's a standard menu option
					menuAction[text]();
				}else{
					// it's something unique to this settings section
					switch(gameState){
						case 'settings':
							handle_settings_selection();
							break;
						case 'controls':
							handle_controls_selection();
							break;
						case 'about_1': case 'about_2':
							handle_about_selection();
							break;
						case 'help_1': case 'help_2': case 'help_3': case 'help_4':
						case 'help_5': case 'help_6': case 'help_7': case 'help_8':
						case 'help_9': case 'help_10': case 'help_11': case 'help_12':
						case 'help_13':
							handle_help_key(code);
					}
				}
				break;
			case KEYMAP.ESC:
				var doit = true;
				switch(gameState){
					case 'controls': gameState = 'settings'; break;
					case 'lives': gameState = 'settings'; break;

					case 'settings': case 'about_1': case 'about_2':
					case 'help_1': case 'help_2': case 'help_3': case 'help_4':
					case 'help_5': case 'help_6': case 'help_7': case 'help_8':
					case 'help_9': case 'help_10': case 'help_11': case 'help_12':
					case 'help_13':
						gameState = 'menu'; break;
					case 'menu':
						if(typeof exitFunc == "undefined"){
							history.go(-1);
						}else{
							exitFunc();
						}
						break;

					default: doit = false;
				}
				if(doit){
					loadSection(gameState);
				}
				break;
			default:
				switch(gameState){
					case 'controls':
						handle_controls_key(code);
						break;
					case 'about_1': case 'about_2':
						handle_about_key(code);
						break;
				}
		}
	}

	function handle_startinglevel_key(code){
		var n, option;
		switch(code){
			case KEYMAP.UP:
				if(lastMenuSelect > 0){
					option = menuOptions[lastMenuSelect - 1];
					$('.menuButton').css({'color':'#FFC', 'background-color':'#000'});
					option.css({'color':'#000', 'background-color':'#FFC'});
					for(n in menuOptions){
						if(menuOptions[n].text() == option.text()){
							var pos1 = menuOptions[n].position().top;
							var pos2 = $('#menuScroller').position().top;
							var minpos = 180;
							if(pos2 + pos1 < minpos){
								$('#menuScroller').css('top',  ( - pos1) + 'px');
							}
							lastMenuSelect = 1 * n;
							break;
						}
					}
				}
				break;
			case KEYMAP.DOWN:
				if(lastMenuSelect < menuOptions.length - 1){
					option = menuOptions[lastMenuSelect + 1];
					$('.menuButton').css({'color':'#FFC', 'background-color':'#000'});
					option.css({'color':'#000', 'background-color':'#FFC'});

					for(n in menuOptions){
						if(menuOptions[n].text() == option.text()){
							var pos1 = menuOptions[n].position().top;
							var pos2 = $('#menuScroller').position().top;
							var maxpos = 420;
							if(pos2 + pos1 > maxpos){
								$('#menuScroller').css('top',  (240 - pos1) + 'px');
							}
							lastMenuSelect = 1 * n;
							break;
						}
					}
				}
				break;
			case KEYMAP.ENTER:
			case KEYMAP.SPACE:
				var selectedIdTag = menuOptions[lastMenuSelect].attr('id');
				startingLevel = 1 * selectedIdTag.split('_')[1];
				//!!! Intentional lack of a break here.
			case KEYMAP.ESC:
				gameState = 'settings';
				loadSection(gameState);
				break;
		}
	}


	function handle_settings_selection(code){
		// will this be used at all?  Probably not.
	}

	function handle_controls_key(code){
		switch(code){
			case KEYMAP.RIGHT:
				var nextMenuSelect = lastMenuSelect + 5;
				if(nextMenuSelect > 10) nextMenuSelect = 10;
				menuSelect(menuOptions[nextMenuSelect]);
				break;
			case KEYMAP.LEFT:
				var nextMenuSelect = lastMenuSelect - 5;
				if(nextMenuSelect < 0) nextMenuSelect = 0;
				menuSelect(menuOptions[nextMenuSelect]);
				break;
		}
		
	}

	function handle_controls_selection(){
		var selectText = menuOptions[lastMenuSelect].html();
		var option = selectText.split(':')[0];
		if({'UP':0, 'DOWN':0, 'LEFT':0, 'RIGHT':0, 'DIG LEFT':0, 'DIG RIGHT':0, 'DIE':0, 'SKIP LEVEL':0, 'PAUSE':0, 'QUIT':0}[option] != undefined){
			gameState = 'getkey';

			wrapper = $('<div id="keyprompt"></div>');
			wrapper.append("PUSH NEW " + option + " KEY");
			wrapper.appendTo($('#menuWrapper'));
		}

	}

	function handle_key_select(code){
		var n;
		var selectText = menuOptions[lastMenuSelect].html();
		var option = selectText.split(':')[0];
		if({'UP':0, 'DOWN':0, 'LEFT':0, 'RIGHT':0, 'DIG LEFT':0, 'DIG RIGHT':0, 'DIE':0, 'SKIP LEVEL':0, 'PAUSE':0, 'QUIT':0}[option] != undefined){
			var chosenKey = REV_KEYMAP[code];
			var keyInUse = false;
			for(n in controls){
				if(controls[n] == chosenKey){
					keyInUse = n;
					break;
				}
			}
			if(keyInUse == false){
				controls[option] = chosenKey;
			}else if(keyInUse != option){
				controls[keyInUse] = controls[option];
				controls[option] = chosenKey;
			}
		}
		draw_control_keys();
		gameState = 'controls';
	}

	function handle_about_key(code){
		switch(code){
			case KEYMAP.RIGHT:
				var maxval = $('.menuButton').length - 1;
				var nextMenuSelect = lastMenuSelect + 1;
				if(nextMenuSelect > maxval) nextMenuSelect = maxval;
				menuSelect(menuOptions[nextMenuSelect]);
				break;
			case KEYMAP.LEFT:
				var nextMenuSelect = lastMenuSelect - 1;
				if(nextMenuSelect < 0) nextMenuSelect = 0;
				menuSelect(menuOptions[nextMenuSelect]);
				break;
			default:
		}
	}

	function handle_about_selection(){
		var selectText = menuOptions[lastMenuSelect].html();
		var option = selectText.split(':')[0];
		if({'NEXT':0}[option] != undefined){
			var currentStep = 1 * gameState.split('_')[1] + 1;
			gameState = 'about_' + currentStep;
			loadSection(gameState);
		}
		if({'PREVIOUS':0}[option] != undefined){
			var currentStep = 1 * gameState.split('_')[1] - 1;
			gameState = 'about_' + currentStep;
			loadSection(gameState);
		}
	}

	function menuSelect(option){
		var n;
		$('.menuButton').css({'color':'#FFC', 'background' : 'none'});
		option.css({'color':'#000', 'background-color':'#FFC'});
		for(n in menuOptions){
			if(menuOptions[n].text() == option.text()){
				lastMenuSelect = 1 * n;
				break;
			}
		}
	}

	var menuAction = {
		'PLAY' : function(){
			hideMenu();
			startGame(startingLevel);
		},
		'SETTINGS' : function(){
			gameState = 'settings';
			loadSection(gameState);
		},
		'HELP' : function(){
			gameState = 'help_1';
			loadSection(gameState);
		},
		'ABOUT' : function(){
			gameState = 'about_1';
			loadSection(gameState);
		},
		'EXIT' : function(){
			if(typeof exitFunc == "undefined"){
				history.go(-1);
			}else{
				exitFunc();
			}

		},
		'MAIN MENU' : function(){
			gameState = 'menu';
			loadSection(gameState);
		},
		'STARTING LEVEL' : function(){
			gameState = 'startinglevel';
			loadSection(gameState);
		},
		'STARTING LIVES' : function(){
			gameState = 'lives';
			loadSection(gameState);
		},
		'THEME' : function(){
//			alert('theme');
		},
		'CONTROL KEYS': function(){
			gameState = 'controls';
			draw_control_keys();
		},
		'5 LIVES': function(){
			startingLives = 5;
			gameState = 'settings';
			loadSection(gameState);
		},
		'UNLIMITED' : function(){
			startingLives = 'UNLIMITED';
			gameState = 'settings';
			loadSection(gameState);
		}
	}

	function hideMenu(){
		$('#landingPage').css('display', 'none');
	}

	function buildMenu(){
		menuOptions = [];
		$('.menuButton').each(function(index){
			menuOptions[index] = $(this);
		});
		menuSelect(menuOptions[0]);

		$('.menuButton').hover(function(){
			menuSelect($(this));
		});

		$('.menuButton').click(function(){
			handle_menuKey(KEYMAP.SPACE);
			return false;
		});
	}

	function loadSection(section){
		if(section_content[section] != undefined){
			$('#menuWrapper').html(section_content[section]);
			buildMenu();
		}else{
			$('#menuWrapper').load('index.php?action=' + section, function(){
				section_content[section] = $('#menuWrapper').html();
				buildMenu();
			});
		}
	}

	function draw_control_keys(){
		var n;
		var button;
		var menuColumn;
		var mainTitle = $('<div id="mainTitle"><?=_GAMETITLE;?><br/><span class="subheader">CONTROL KEYS</span></div>');
		$('#menuWrapper').empty();
		mainTitle.appendTo($('#menuWrapper'));
		var tally = 0;
		for(n in controls){
			if(!(tally % 5)){
				if(menuColumn != undefined){
					menuColumn.appendTo($('#menuWrapper'));
				}
				menuColumn = $('<div></div>');
				menuColumn.css({'display':'inline-block', 'vertical-align':'top'});
			}
			button = $('<div class="menuButton" style="width: 360px;"></div>');
			button.append(n + ': ' + controls[n]);
			menuColumn.append(button);
			tally++;
		}
		menuColumn.appendTo($('#menuWrapper'));

		button = $('<div class="menuButton">SETTINGS</div>');
		button.css('margin-top', '.5em');
		$('#menuWrapper').append(button);
		buildMenu();
	}

	</script>
</head>
<body>
	<div id="pageWrapper">
		<div id="gameWrapper">
			<div id="gameCanvas"></div>
			<div id="gameFooter">
				<div id="lives" class="footerContent"></div>
				<div id="level" class="footerContent"></div>
			</div>
			<div id="gameOverlay"></div>
		</div>
		<div id="landingPage">
			<div id="menuWrapper">
			<?php
				draw_main_menu();
			?>
			</div>
		</div>
	</div>
</body>
</html>
