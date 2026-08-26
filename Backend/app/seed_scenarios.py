"""
Seed bank of scenarios. In production this lives in Postgres; for the demo
we keep it in memory. Each entry is a full scenario the renderer plays.

The bank must hold at least QUESTIONS_PER_TEST unique scenarios or a test
would have to repeat questions — see `sanity_check()` at the bottom, which
is asserted by the test suite. Every Competency has at least one entry so
the round-robin selector in engine.build_test() produces a balanced test.
The coordinates are simple placeholders; the renderer owns final art.
"""

from .models import Actor, CameraKeyframe, Competency, Option, Scenario

SCENARIOS: list[Scenario] = [
    # ----------------------------- pedestrian safety -----------------------
    Scenario(
        id="sc_ped_crosswalk_01",
        competency=Competency.PEDESTRIAN_SAFETY,
        difficulty=1,
        duration_s=6.0,
        prompt="A pedestrian steps onto the zebra crossing ahead as you approach. What do you do?",
        prompt_hi="आपके आगे ज़ेबरा क्रॉसिंग पर एक पैदल यात्री आ जाता है। आप क्या करेंगे?",
        scene_env="urban_intersection",
        actors=[
            Actor(id="ped1", kind="pedestrian", asset="ped_adult",
                  path=[[0, -4, 0, 2], [3, 0, 0, 2]]),
            Actor(id="zebra", kind="marking", asset="zebra_crossing"),
        ],
        camera=[
            CameraKeyframe(t=0.0, position=[0, 1.5, -8], look_at=[0, 0, 5]),
            CameraKeyframe(t=5.0, position=[0, 1.5, -3], look_at=[0, 0, 5]),
        ],
        options=[
            Option(id="a", label="Stop and let the pedestrian cross",
                   label_hi="रुकें और पैदल यात्री को जाने दें"),
            Option(id="b", label="Honk and continue", label_hi="हॉर्न बजाकर आगे बढ़ें"),
            Option(id="c", label="Swerve around them", label_hi="बगल से निकल जाएँ"),
        ],
        correct_option_id="a",
        explanation="Pedestrians on a zebra crossing have absolute right of way. "
                    "You must stop and allow them to cross safely.",
        mv_act_ref="Rule 8, RRR 1989",
    ),
    Scenario(
        id="sc_ped_schoolbus_01",
        competency=Competency.PEDESTRIAN_SAFETY,
        difficulty=2,
        duration_s=7.0,
        prompt="A school bus ahead has stopped and children are getting off onto the road. What do you do?",
        prompt_hi="आगे एक स्कूल बस रुकी है और बच्चे सड़क पर उतर रहे हैं। आप क्या करेंगे?",
        scene_env="urban_road",
        actors=[
            Actor(id="bus", kind="bus", asset="school_bus", meta={"stopped": True}),
            Actor(id="kid1", kind="pedestrian", asset="ped_child",
                  path=[[0, 2, 0, 8], [3, -2, 0, 8]]),
        ],
        camera=[CameraKeyframe(t=0.0, position=[0, 1.6, -10], look_at=[0, 0, 8])],
        options=[
            Option(id="a", label="Stop well back and wait until all children are clear",
                   label_hi="काफ़ी पीछे रुकें और सभी बच्चों के हटने तक इंतज़ार करें"),
            Option(id="b", label="Overtake the bus quickly on the right",
                   label_hi="दाईं ओर से बस को तेज़ी से ओवरटेक करें"),
            Option(id="c", label="Creep past slowly while sounding the horn",
                   label_hi="हॉर्न बजाते हुए धीरे-धीरे निकल जाएँ"),
        ],
        correct_option_id="a",
        explanation="Children are unpredictable and may run across without looking. "
                    "A stopped school bus means stop and wait, not pass.",
        mv_act_ref="Rule 8 & duty of care, RRR 1989",
    ),

    # ----------------------------- right of way ----------------------------
    Scenario(
        id="sc_row_uncontrolled_01",
        competency=Competency.RIGHT_OF_WAY,
        difficulty=2,
        duration_s=7.0,
        prompt="You reach an uncontrolled crossroads at the same time as a car on your right. Who goes first?",
        prompt_hi="आप और दाईं ओर से आती एक कार बिना सिग्नल वाले चौराहे पर एक साथ पहुँचते हैं। पहले कौन जाएगा?",
        scene_env="urban_intersection",
        actors=[
            Actor(id="carR", kind="car", asset="car_hatch",
                  path=[[0, 10, 0, 6], [4, 1, 0, 6]]),
        ],
        camera=[CameraKeyframe(t=0.0, position=[0, 1.5, -9], look_at=[4, 0, 5])],
        options=[
            Option(id="a", label="The vehicle on your right — give way to it",
                   label_hi="दाईं ओर का वाहन — उसे रास्ता दें"),
            Option(id="b", label="You do, because you arrived first",
                   label_hi="आप, क्योंकि आप पहले पहुँचे"),
            Option(id="c", label="Whoever accelerates faster",
                   label_hi="जो तेज़ी से आगे बढ़े"),
        ],
        correct_option_id="a",
        explanation="At an uncontrolled junction, traffic approaching from your right "
                    "has priority. Slow, look right, and give way.",
        mv_act_ref="Rule 9, RRR 1989",
    ),
    Scenario(
        id="sc_row_right_turn_01",
        competency=Competency.RIGHT_OF_WAY,
        difficulty=3,
        duration_s=8.0,
        prompt="You are turning right across the junction. Traffic is coming straight towards you. What is correct?",
        prompt_hi="आप चौराहे पर दाएँ मुड़ रहे हैं। सामने से सीधा ट्रैफ़िक आ रहा है। सही क्या है?",
        scene_env="urban_intersection",
        actors=[
            Actor(id="onc", kind="car", asset="car_sedan",
                  path=[[0, 0, 0, 30], [5, 0, 0, 2]]),
        ],
        camera=[CameraKeyframe(t=0.0, position=[0, 1.5, -6], look_at=[0, 0, 18])],
        options=[
            Option(id="a", label="Wait — oncoming traffic going straight has priority",
                   label_hi="रुकें — सीधा जाने वाले सामने के ट्रैफ़िक को प्राथमिकता है"),
            Option(id="b", label="Turn first, you are already in the junction",
                   label_hi="पहले मुड़ें, आप चौराहे में पहले से हैं"),
            Option(id="c", label="Signal and turn; they must brake for you",
                   label_hi="संकेत देकर मुड़ें; उन्हें ब्रेक लगाना होगा"),
        ],
        correct_option_id="a",
        explanation="A right turn crosses the path of oncoming traffic, which has "
                    "priority. Wait in position until there is a safe gap.",
        mv_act_ref="Rule 12, RRR 1989",
    ),

    # ------------------------------ roundabout -----------------------------
    Scenario(
        id="sc_roundabout_01",
        competency=Competency.ROUNDABOUT,
        difficulty=2,
        duration_s=7.0,
        prompt="You reach a roundabout. A vehicle is already circulating from your right. What is correct?",
        prompt_hi="आप एक गोल चक्कर पर पहुँचते हैं। दाईं ओर से एक वाहन पहले से घूम रहा है। सही क्या है?",
        scene_env="roundabout",
        actors=[
            Actor(id="carR", kind="car", asset="car_sedan",
                  path=[[0, 8, 0, 0], [4, 0, 0, 3]]),
        ],
        camera=[CameraKeyframe(t=0.0, position=[0, 1.5, -10], look_at=[3, 0, 0])],
        options=[
            Option(id="a", label="Give way to the vehicle on the right, then enter",
                   label_hi="दाईं ओर के वाहन को रास्ता दें, फिर प्रवेश करें"),
            Option(id="b", label="Enter immediately, you have priority",
                   label_hi="तुरंत प्रवेश करें, प्राथमिकता आपकी है"),
            Option(id="c", label="Stop fully until the roundabout is empty",
                   label_hi="जब तक गोल चक्कर खाली न हो, पूरी तरह रुकें"),
        ],
        correct_option_id="a",
        explanation="At a roundabout, give way to traffic already circulating "
                    "from your right before entering.",
        mv_act_ref="Rule 10, RRR 1989",
    ),
    Scenario(
        id="sc_roundabout_exit_01",
        competency=Competency.ROUNDABOUT,
        difficulty=2,
        duration_s=7.0,
        prompt="You are circulating a roundabout and your exit is next. What should you do?",
        prompt_hi="आप गोल चक्कर में घूम रहे हैं और आपका निकास अगला है। आपको क्या करना चाहिए?",
        scene_env="roundabout",
        actors=[
            Actor(id="exitSign", kind="sign", asset="sign_exit", meta={"exit": 2}),
        ],
        camera=[CameraKeyframe(t=0.0, position=[-3, 1.5, -3], look_at=[2, 0, 4])],
        options=[
            Option(id="a", label="Signal left, move to the left lane and exit",
                   label_hi="बाएँ संकेत दें, बाईं लेन में आएँ और निकलें"),
            Option(id="b", label="Exit from the inner lane without signalling",
                   label_hi="बिना संकेत भीतरी लेन से ही निकल जाएँ"),
            Option(id="c", label="Stop on the roundabout and wait for a gap",
                   label_hi="गोल चक्कर पर रुककर जगह का इंतज़ार करें"),
        ],
        correct_option_id="a",
        explanation="Signal left before your exit and move to the left lane in good "
                    "time. Never cut across lanes or stop on the roundabout.",
        mv_act_ref="Rule 10, RRR 1989",
    ),

    # ------------------------------ overtaking -----------------------------
    Scenario(
        id="sc_overtake_01",
        competency=Competency.OVERTAKING,
        difficulty=3,
        duration_s=8.0,
        prompt="You want to overtake, but there is a solid yellow line and an oncoming vehicle. What is correct?",
        prompt_hi="आप ओवरटेक करना चाहते हैं, पर ठोस पीली रेखा है और सामने से वाहन आ रहा है। सही क्या है?",
        scene_env="two_lane_highway",
        actors=[
            Actor(id="lead", kind="car", asset="truck", path=[[0, 0, 0, 6], [6, 0, 0, 12]]),
            Actor(id="onc", kind="car", asset="car_sedan", path=[[0, 0.2, 0, 40], [6, 0.2, 0, 10]]),
            Actor(id="line", kind="marking", asset="solid_yellow"),
        ],
        camera=[CameraKeyframe(t=0.0, position=[0, 1.5, -6], look_at=[0, 0, 20])],
        options=[
            Option(id="a", label="Do not overtake; stay behind until it is safe and legal",
                   label_hi="ओवरटेक न करें; सुरक्षित और वैध होने तक पीछे रहें"),
            Option(id="b", label="Overtake quickly before the oncoming car arrives",
                   label_hi="सामने वाली गाड़ी आने से पहले जल्दी ओवरटेक करें"),
            Option(id="c", label="Overtake from the left",
                   label_hi="बाईं ओर से ओवरटेक करें"),
        ],
        correct_option_id="a",
        explanation="A solid yellow line prohibits overtaking. With an oncoming "
                    "vehicle it is doubly unsafe. Wait for a safe, legal gap.",
        mv_act_ref="Rule 2 & road markings, RRR 1989",
    ),
    Scenario(
        id="sc_overtake_turning_01",
        competency=Competency.OVERTAKING,
        difficulty=3,
        duration_s=7.0,
        prompt="The vehicle ahead has signalled and is waiting to turn right. How may you pass it?",
        prompt_hi="आगे का वाहन दाएँ मुड़ने का संकेत देकर रुका है। आप उसे कैसे पार कर सकते हैं?",
        scene_env="two_lane_highway",
        actors=[
            Actor(id="lead", kind="car", asset="car_sedan", meta={"indicator": "right"}),
        ],
        camera=[CameraKeyframe(t=0.0, position=[0, 1.5, -7], look_at=[0, 0, 8])],
        options=[
            Option(id="a", label="Pass on its left, if there is room and it is safe",
                   label_hi="यदि जगह हो और सुरक्षित हो तो उसकी बाईं ओर से निकलें"),
            Option(id="b", label="Pass on its right as usual",
                   label_hi="हमेशा की तरह दाईं ओर से निकलें"),
            Option(id="c", label="Honk until it moves aside",
                   label_hi="हॉर्न बजाएँ जब तक वह हट जाए"),
        ],
        correct_option_id="a",
        explanation="Overtaking is normally on the right, but when the vehicle ahead "
                    "is signalling and waiting to turn right, you pass on its left.",
        mv_act_ref="Rule 6, RRR 1989",
    ),

    # --------------------------- emergency vehicle -------------------------
    Scenario(
        id="sc_ambulance_01",
        competency=Competency.EMERGENCY_VEHICLE,
        difficulty=1,
        duration_s=6.0,
        prompt="An ambulance with siren approaches from behind in heavy traffic. What do you do?",
        prompt_hi="भारी ट्रैफ़िक में पीछे से सायरन बजाती एम्बुलेंस आ रही है। आप क्या करेंगे?",
        scene_env="urban_road",
        actors=[
            Actor(id="amb", kind="ambulance", asset="ambulance",
                  path=[[0, 0, 0, -12], [4, 0, 0, -2]], meta={"siren": True}),
        ],
        camera=[CameraKeyframe(t=0.0, position=[-2, 1.5, 0], look_at=[0, 0, -6])],
        options=[
            Option(id="a", label="Pull to the left and give a clear path",
                   label_hi="बाईं ओर होकर रास्ता दें"),
            Option(id="b", label="Speed up to stay ahead of it",
                   label_hi="आगे रहने के लिए गति बढ़ाएँ"),
            Option(id="c", label="Stop dead in your lane",
                   label_hi="अपनी लेन में ही रुक जाएँ"),
        ],
        correct_option_id="a",
        explanation="Emergency vehicles must be given free passage. Move left and "
                    "let it pass; never block or race it.",
        mv_act_ref="Rule 18, RRR 1989",
    ),
    Scenario(
        id="sc_fire_engine_redlight_01",
        competency=Competency.EMERGENCY_VEHICLE,
        difficulty=3,
        duration_s=7.0,
        prompt="You are stopped at a red light. A fire engine with siren is behind you. What do you do?",
        prompt_hi="आप लाल सिग्नल पर रुके हैं। पीछे सायरन बजाती दमकल गाड़ी है। आप क्या करेंगे?",
        scene_env="urban_intersection",
        actors=[
            Actor(id="fire", kind="fire_engine", asset="fire_engine",
                  path=[[0, 0, 0, -14], [4, 0, 0, -3]], meta={"siren": True}),
            Actor(id="signal", kind="signal", asset="traffic_signal", meta={"state": "red"}),
        ],
        camera=[CameraKeyframe(t=0.0, position=[-2, 1.6, 0], look_at=[0, 0, -8])],
        options=[
            Option(id="a", label="Move aside only as far as you safely can without entering the junction on red",
                   label_hi="लाल सिग्नल पर चौराहे में घुसे बिना जितना सुरक्षित हो उतना किनारे हों"),
            Option(id="b", label="Jump the red light to clear the way",
                   label_hi="रास्ता देने के लिए लाल सिग्नल तोड़ दें"),
            Option(id="c", label="Stay exactly where you are and ignore it",
                   label_hi="जहाँ हैं वहीं रहें और ध्यान न दें"),
        ],
        correct_option_id="a",
        explanation="Give way as far as you safely can, but a siren does not "
                    "authorise you to cross a red signal into cross-traffic.",
        mv_act_ref="Rule 18 & signal obedience, RRR 1989",
    ),

    # ---------------------------- lane discipline --------------------------
    Scenario(
        id="sc_lane_01",
        competency=Competency.LANE_DISCIPLINE,
        difficulty=1,
        duration_s=6.0,
        prompt="On a multi-lane road you are driving slowly. Which lane should you use?",
        prompt_hi="बहु-लेन सड़क पर आप धीमे चल रहे हैं। आपको कौन-सी लेन इस्तेमाल करनी चाहिए?",
        scene_env="multi_lane_road",
        actors=[Actor(id="fast", kind="car", asset="car_sedan", path=[[0, 3, 0, -10], [4, 3, 0, 10]])],
        camera=[CameraKeyframe(t=0.0, position=[0, 2, -8], look_at=[0, 0, 6])],
        options=[
            Option(id="a", label="Keep to the left; leave right lanes for overtaking/faster traffic",
                   label_hi="बाईं ओर रहें; दाईं लेन ओवरटेक/तेज़ ट्रैफ़िक के लिए छोड़ें"),
            Option(id="b", label="Drive in the rightmost lane",
                   label_hi="सबसे दाईं लेन में चलें"),
            Option(id="c", label="Straddle two lanes", label_hi="दो लेन के बीच चलें"),
        ],
        correct_option_id="a",
        explanation="Slower traffic keeps left. The right lane is for overtaking "
                    "and faster-moving vehicles.",
        mv_act_ref="Rule 2, RRR 1989",
    ),
    Scenario(
        id="sc_lane_merge_01",
        competency=Competency.LANE_DISCIPLINE,
        difficulty=2,
        duration_s=7.0,
        prompt="You need to change lanes to the right in moving traffic. What is the correct sequence?",
        prompt_hi="चलते ट्रैफ़िक में आपको दाईं लेन में जाना है। सही क्रम क्या है?",
        scene_env="multi_lane_road",
        actors=[
            Actor(id="side", kind="motorcycle", asset="motorcycle",
                  path=[[0, 3, 0, -6], [4, 3, 0, 4]]),
        ],
        camera=[CameraKeyframe(t=0.0, position=[0, 1.6, -6], look_at=[3, 0, 4])],
        options=[
            Option(id="a", label="Mirror, signal, check the blind spot, then move when clear",
                   label_hi="मिरर देखें, संकेत दें, ब्लाइंड स्पॉट जाँचें, फिर साफ़ होने पर बदलें"),
            Option(id="b", label="Move across first, then signal",
                   label_hi="पहले लेन बदलें, फिर संकेत दें"),
            Option(id="c", label="Signal and move immediately — others will adjust",
                   label_hi="संकेत देकर तुरंत बदल लें — बाकी लोग संभाल लेंगे"),
        ],
        correct_option_id="a",
        explanation="Mirror–signal–blind spot–manoeuvre. Two-wheelers hide easily in "
                    "the blind spot, so the check is not optional.",
        mv_act_ref="Rule 6 & 14, RRR 1989",
    ),

    # --------------------------- sign recognition --------------------------
    Scenario(
        id="sc_sign_stop_01",
        competency=Competency.SIGN_RECOGNITION,
        difficulty=1,
        duration_s=5.0,
        prompt="You approach this sign at a junction. What does it require?",
        prompt_hi="आप जंक्शन पर इस चिन्ह के पास पहुँचते हैं। यह क्या आवश्यक करता है?",
        scene_env="urban_intersection",
        actors=[Actor(id="sign", kind="sign", asset="sign_stop", meta={"sign": "STOP"})],
        camera=[CameraKeyframe(t=0.0, position=[0, 1.5, -6], look_at=[1, 1, 2])],
        options=[
            Option(id="a", label="Come to a complete stop, then proceed when safe",
                   label_hi="पूरी तरह रुकें, फिर सुरक्षित होने पर आगे बढ़ें"),
            Option(id="b", label="Slow down only", label_hi="केवल गति धीमी करें"),
            Option(id="c", label="Maintain speed", label_hi="गति बनाए रखें"),
        ],
        correct_option_id="a",
        explanation="A STOP sign is mandatory — a full stop is required before "
                    "proceeding, regardless of whether the road looks clear.",
        mv_act_ref="Mandatory signs, RRR 1989",
    ),
    Scenario(
        id="sc_sign_noentry_01",
        competency=Competency.SIGN_RECOGNITION,
        difficulty=1,
        duration_s=5.0,
        prompt="A red circle with a white horizontal bar is posted at the road ahead. What does it mean?",
        prompt_hi="आगे सड़क पर सफ़ेद पट्टी वाला लाल गोल चिन्ह लगा है। इसका क्या अर्थ है?",
        scene_env="urban_road",
        actors=[Actor(id="sign", kind="sign", asset="sign_no_entry", meta={"sign": "NO_ENTRY"})],
        camera=[CameraKeyframe(t=0.0, position=[0, 1.5, -6], look_at=[1, 1.2, 3])],
        options=[
            Option(id="a", label="No entry — you must not drive down this road",
                   label_hi="प्रवेश निषेध — इस सड़क पर नहीं जा सकते"),
            Option(id="b", label="No parking on this road",
                   label_hi="इस सड़क पर पार्किंग निषेध"),
            Option(id="c", label="One-way road you may enter carefully",
                   label_hi="एकतरफ़ा सड़क, सावधानी से जा सकते हैं"),
        ],
        correct_option_id="a",
        explanation="A red circle with a white bar is NO ENTRY. Entering it puts you "
                    "head-on into legal traffic.",
        mv_act_ref="Mandatory signs, RRR 1989",
    ),
    Scenario(
        id="sc_sign_speedlimit_01",
        competency=Competency.SIGN_RECOGNITION,
        difficulty=2,
        duration_s=6.0,
        prompt="A red-bordered circle reads 50. Road is empty and traffic around you is faster. What is correct?",
        prompt_hi="लाल किनारे वाले गोल चिन्ह पर 50 लिखा है। सड़क खाली है और आसपास का ट्रैफ़िक तेज़ है। सही क्या है?",
        scene_env="multi_lane_road",
        actors=[Actor(id="sign", kind="sign", asset="sign_speed_50", meta={"limit": 50})],
        camera=[CameraKeyframe(t=0.0, position=[0, 1.5, -7], look_at=[1.5, 1.2, 4])],
        options=[
            Option(id="a", label="Stay at or below 50 km/h — it is a legal maximum",
                   label_hi="50 किमी/घंटा या कम रखें — यह कानूनी अधिकतम सीमा है"),
            Option(id="b", label="Match the speed of surrounding traffic",
                   label_hi="आसपास के ट्रैफ़िक की गति से चलें"),
            Option(id="c", label="It is only advisory when the road is empty",
                   label_hi="खाली सड़क पर यह केवल सलाह है"),
        ],
        correct_option_id="a",
        explanation="A speed-limit sign is a legal maximum, not a suggestion, and it "
                    "does not rise because other drivers are speeding.",
        mv_act_ref="Section 112, MV Act 1988",
    ),

    # -------------------------- hazard anticipation ------------------------
    Scenario(
        id="sc_hazard_child_01",
        competency=Competency.HAZARD_ANTICIPATION,
        difficulty=2,
        duration_s=7.0,
        prompt="A ball rolls into the road from between parked cars. What should you anticipate and do?",
        prompt_hi="खड़ी गाड़ियों के बीच से एक गेंद सड़क पर आती है। आपको क्या अनुमान लगाना और करना चाहिए?",
        scene_env="residential_street",
        actors=[
            Actor(id="ball", kind="object", asset="ball", path=[[0, -3, 0, 4], [1.5, 0, 0, 4]]),
            Actor(id="parked", kind="car", asset="car_parked"),
        ],
        camera=[CameraKeyframe(t=0.0, position=[0, 1.5, -8], look_at=[0, 0, 5])],
        options=[
            Option(id="a", label="Slow down — a child may follow the ball",
                   label_hi="गति धीमी करें — गेंद के पीछे बच्चा आ सकता है"),
            Option(id="b", label="Continue, it is only a ball",
                   label_hi="आगे बढ़ें, यह सिर्फ़ एक गेंद है"),
            Option(id="c", label="Honk and speed up", label_hi="हॉर्न बजाकर गति बढ़ाएँ"),
        ],
        correct_option_id="a",
        explanation="A ball often means a child is about to run out. Anticipate the "
                    "hazard and slow down immediately.",
        mv_act_ref="Defensive driving principles",
    ),
    Scenario(
        id="sc_hazard_bus_01",
        competency=Competency.HAZARD_ANTICIPATION,
        difficulty=2,
        duration_s=7.0,
        prompt="A bus is stopped at a bus stop on your left, passengers around it. What is the safest action?",
        prompt_hi="बाईं ओर बस स्टॉप पर बस रुकी है, आसपास यात्री हैं। सबसे सुरक्षित क्या है?",
        scene_env="urban_road",
        actors=[
            Actor(id="bus", kind="bus", asset="city_bus", meta={"stopped": True}),
            Actor(id="ped2", kind="pedestrian", asset="ped_adult",
                  path=[[0, -3, 0, 7], [3, 0.5, 0, 7]]),
        ],
        camera=[CameraKeyframe(t=0.0, position=[0, 1.6, -9], look_at=[0, 0, 7])],
        options=[
            Option(id="a", label="Slow down and leave a wide gap — someone may step out from in front of the bus",
                   label_hi="गति धीमी करें और चौड़ी दूरी रखें — बस के आगे से कोई निकल सकता है"),
            Option(id="b", label="Keep your speed, you are in a different lane",
                   label_hi="गति बनाए रखें, आप दूसरी लेन में हैं"),
            Option(id="c", label="Overtake close and fast to get past the crowd",
                   label_hi="भीड़ से बचने के लिए सटकर तेज़ी से निकलें"),
        ],
        correct_option_id="a",
        explanation="A stopped bus hides pedestrians crossing in front of it. Reduce "
                    "speed and widen your gap so you can stop in time.",
        mv_act_ref="Defensive driving principles",
    ),

    # ----------------------------- night / weather -------------------------
    Scenario(
        id="sc_night_01",
        competency=Competency.NIGHT_WEATHER,
        difficulty=2,
        duration_s=6.0,
        prompt="A vehicle approaches at night with high beams on. What is the correct response?",
        prompt_hi="रात में सामने से एक वाहन हाई बीम जलाकर आ रहा है। सही प्रतिक्रिया क्या है?",
        scene_env="night_highway",
        actors=[Actor(id="onc", kind="car", asset="car_sedan", path=[[0, 0, 0, 40], [5, 0, 0, 5]], meta={"highbeam": True})],
        camera=[CameraKeyframe(t=0.0, position=[0, 1.5, -6], look_at=[0, 0, 20])],
        options=[
            Option(id="a", label="Dip your headlights and look slightly to the left edge",
                   label_hi="अपनी हेडलाइट डिम करें और बाएँ किनारे की ओर देखें"),
            Option(id="b", label="Switch to high beam too", label_hi="आप भी हाई बीम कर दें"),
            Option(id="c", label="Close your eyes briefly", label_hi="कुछ पल आँखें बंद कर लें"),
        ],
        correct_option_id="a",
        explanation="Dip your beams to avoid dazzling others and reduce your own "
                    "glare by focusing on the left road edge.",
        mv_act_ref="Rule 20, RRR 1989",
    ),
    Scenario(
        id="sc_fog_01",
        competency=Competency.NIGHT_WEATHER,
        difficulty=3,
        duration_s=7.0,
        prompt="You enter dense fog on a highway and visibility drops sharply. What do you do?",
        prompt_hi="राजमार्ग पर घने कोहरे में दृश्यता अचानक घट जाती है। आप क्या करेंगे?",
        scene_env="fog_highway",
        actors=[Actor(id="fog", kind="weather", asset="fog_volume", meta={"visibility_m": 30})],
        camera=[CameraKeyframe(t=0.0, position=[0, 1.5, -6], look_at=[0, 0, 15])],
        options=[
            Option(id="a", label="Slow down, use low beam and fog lights, and increase your following distance",
                   label_hi="गति कम करें, लो बीम व फ़ॉग लाइट जलाएँ, और आगे की दूरी बढ़ाएँ"),
            Option(id="b", label="Use high beam to see further",
                   label_hi="दूर देखने के लिए हाई बीम जलाएँ"),
            Option(id="c", label="Follow the tail lights of the vehicle ahead closely",
                   label_hi="आगे वाले वाहन की टेल लाइट के पास-पास चलें"),
        ],
        correct_option_id="a",
        explanation="High beam reflects off fog and blinds you. Use low beam and fog "
                    "lights, cut speed, and keep a much larger gap.",
        mv_act_ref="Rule 20 & Section 112, MV Act 1988",
    ),

    # =======================================================================
    # Second pass over every competency.
    #
    # A ten-question test drawn from nineteen scenarios is one a determined
    # candidate can simply memorise — two sittings see almost the whole bank.
    # These take it to forty, and they lean on the roads this test is actually
    # for: unmarked breakers, cattle on a highway, a blocked footpath, an
    # unmanned level crossing, a "Horn OK Please" tailboard.
    # =======================================================================

    # ----------------------------- right of way ----------------------------
    Scenario(
        id="sc_row_major_road_01",
        competency=Competency.RIGHT_OF_WAY,
        difficulty=1,
        duration_s=6.5,
        prompt="You are emerging from a narrow side lane onto a busy main road. Traffic is flowing steadily. What do you do?",
        prompt_hi="आप एक तंग गली से निकलकर व्यस्त मुख्य सड़क पर आ रहे हैं। वहाँ ट्रैफ़िक लगातार चल रहा है। आप क्या करेंगे?",
        scene_env="urban_intersection",
        actors=[
            Actor(id="main1", kind="car", asset="car_sedan", path=[[0, 14, 0, 0], [4, -6, 0, 0]]),
            Actor(id="main2", kind="two_wheeler", asset="scooter", path=[[1, 18, 0, 1], [5, -2, 0, 1]]),
        ],
        camera=[CameraKeyframe(t=0.0, position=[0, 1.5, -7], look_at=[0, 0, 6])],
        options=[
            Option(id="a", label="Give way and wait for a real gap in the main-road traffic",
                   label_hi="रास्ता दें और मुख्य सड़क पर सचमुच जगह मिलने तक रुकें"),
            Option(id="b", label="Edge out until the traffic is forced to slow for you",
                   label_hi="धीरे-धीरे आगे बढ़ते रहें जब तक ट्रैफ़िक आपके लिए रुकने को मजबूर न हो"),
            Option(id="c", label="Go if you are quick, since your lane arrived first",
                   label_hi="जल्दी से निकल जाएँ, क्योंकि आपकी गली पहले आती है"),
        ],
        correct_option_id="a",
        explanation="Traffic already on the major road has right of way. Nosing out to "
                    "force a gap is what turns a side lane into a collision point.",
        mv_act_ref="Rule 6, RRR 1989",
    ),
    Scenario(
        id="sc_row_turn_across_ped_01",
        competency=Competency.RIGHT_OF_WAY,
        difficulty=2,
        duration_s=7.0,
        prompt="Your signal turns green and you begin a left turn, but people are still crossing the road you are turning into. What do you do?",
        prompt_hi="आपका सिग्नल हरा हो गया है और आप बाएँ मुड़ने लगे हैं, लेकिन जिस सड़क पर आप मुड़ रहे हैं वहाँ लोग अब भी पार कर रहे हैं। आप क्या करेंगे?",
        scene_env="urban_intersection",
        actors=[
            Actor(id="signal", kind="signal", asset="traffic_light", meta={"state": "green"}),
            Actor(id="ped_grp", kind="pedestrian", asset="ped_group", path=[[0, -3, 0, 7], [5, 3, 0, 7]]),
        ],
        camera=[CameraKeyframe(t=0.0, position=[0, 1.5, -8], look_at=[-3, 0, 6])],
        options=[
            Option(id="a", label="Wait for them to finish crossing, then complete the turn",
                   label_hi="उनके पार कर लेने तक रुकें, फिर मुड़ें"),
            Option(id="b", label="Turn anyway — a green signal is your right of way",
                   label_hi="फिर भी मुड़ जाएँ — हरा सिग्नल आपका अधिकार है"),
            Option(id="c", label="Sound the horn so they hurry across",
                   label_hi="हॉर्न बजाएँ ताकि वे जल्दी पार कर लें"),
        ],
        correct_option_id="a",
        explanation="A green signal releases you into the junction; it does not take away "
                    "the right of way of people already crossing the road you turn into.",
        mv_act_ref="Rule 8 & Rule 11, RRR 1989",
    ),
    Scenario(
        id="sc_row_level_crossing_01",
        competency=Competency.RIGHT_OF_WAY,
        difficulty=3,
        duration_s=8.0,
        prompt="You arrive at an unmanned railway level crossing. There is no gate and no one on duty. What do you do?",
        prompt_hi="आप एक बिना फाटक वाली रेलवे क्रॉसिंग पर पहुँचते हैं। न फाटक है, न कोई कर्मचारी। आप क्या करेंगे?",
        scene_env="two_lane_highway",
        actors=[
            Actor(id="track", kind="marking", asset="rail_crossing", meta={"manned": False}),
            Actor(id="sign_x", kind="sign", asset="sign_level_crossing"),
        ],
        camera=[CameraKeyframe(t=0.0, position=[0, 1.6, -12], look_at=[0, 0, 10])],
        options=[
            Option(id="a", label="Stop, look and listen both ways, and cross only when you are certain it is clear",
                   label_hi="रुकें, दोनों ओर देखें और सुनें, और पूरी तरह साफ़ होने पर ही पार करें"),
            Option(id="b", label="Cross at speed so you spend less time on the track",
                   label_hi="तेज़ी से पार करें ताकि पटरी पर कम समय लगे"),
            Option(id="c", label="Follow the vehicle in front without stopping separately",
                   label_hi="बिना अलग से रुके आगे वाले वाहन के पीछे चलते रहें"),
        ],
        correct_option_id="a",
        explanation="A train cannot stop for you and has absolute right of way. At an "
                    "unmanned crossing every driver must stop and check for themselves — "
                    "following the vehicle ahead means trusting a check you did not make.",
        mv_act_ref="Rule 6(2), RRR 1989",
    ),

    # ----------------------------- pedestrian safety -----------------------
    Scenario(
        id="sc_ped_white_cane_01",
        competency=Competency.PEDESTRIAN_SAFETY,
        difficulty=2,
        duration_s=7.0,
        prompt="A person carrying a white cane is stepping onto the road ahead of you. What do you do?",
        prompt_hi="आपके आगे सफ़ेद छड़ी लिए एक व्यक्ति सड़क पर उतर रहा है। आप क्या करेंगे?",
        scene_env="urban_road",
        actors=[
            Actor(id="ped_vi", kind="pedestrian", asset="ped_adult", meta={"white_cane": True},
                  path=[[0, -4, 0, 3], [6, 1, 0, 3]]),
        ],
        camera=[CameraKeyframe(t=0.0, position=[0, 1.5, -9], look_at=[0, 0, 5])],
        options=[
            Option(id="a", label="Stop well short and wait silently until they are fully across",
                   label_hi="काफ़ी पहले रुकें और बिना आवाज़ किए उनके पूरी तरह पार होने तक इंतज़ार करें"),
            Option(id="b", label="Honk repeatedly so they know a vehicle is there",
                   label_hi="बार-बार हॉर्न बजाएँ ताकि उन्हें वाहन का पता चले"),
            Option(id="c", label="Drive slowly around behind them",
                   label_hi="उनके पीछे से धीरे-धीरे निकल जाएँ"),
        ],
        correct_option_id="a",
        explanation="A white cane marks a person who cannot see your vehicle. They have "
                    "priority, and a horn only startles someone navigating by sound — "
                    "stop, stay quiet, and let them finish crossing.",
        mv_act_ref="Rule 8 & duty of care, RRR 1989",
    ),
    Scenario(
        id="sc_ped_footpath_blocked_01",
        competency=Competency.PEDESTRIAN_SAFETY,
        difficulty=2,
        duration_s=7.0,
        prompt="The footpath ahead is blocked by parked two-wheelers and vendors, so people are walking in your lane. What do you do?",
        prompt_hi="आगे फुटपाथ पर दोपहिया और ठेले खड़े हैं, इसलिए लोग आपकी लेन में चल रहे हैं। आप क्या करेंगे?",
        scene_env="urban_road",
        actors=[
            Actor(id="vendor", kind="obstacle", asset="street_vendor"),
            Actor(id="walkers", kind="pedestrian", asset="ped_group", path=[[0, 2, 0, 9], [6, 2, 0, 2]]),
        ],
        camera=[CameraKeyframe(t=0.0, position=[0, 1.5, -10], look_at=[1, 0, 7])],
        options=[
            Option(id="a", label="Slow right down and pass with a wide gap when the oncoming side is clear",
                   label_hi="गति बहुत कम करें और सामने से रास्ता साफ़ होने पर काफ़ी दूरी छोड़कर निकलें"),
            Option(id="b", label="Hold your line — they are walking where they should not be",
                   label_hi="अपनी लेन में ही चलते रहें — वे ग़लत जगह चल रहे हैं"),
            Option(id="c", label="Sound the horn continuously until the lane clears",
                   label_hi="लेन ख़ाली होने तक लगातार हॉर्न बजाएँ"),
        ],
        correct_option_id="a",
        explanation="Whether the footpath should have been clear is not the question in "
                    "front of you. People are on the carriageway, so the speed and the gap "
                    "are yours to give.",
        mv_act_ref="Rule 8 & Section 184, MV Act 1988",
    ),
    Scenario(
        id="sc_ped_reversing_01",
        competency=Competency.PEDESTRIAN_SAFETY,
        difficulty=3,
        duration_s=7.5,
        prompt="You need to reverse out of a tight market lane. Your mirrors do not show the ground right behind the vehicle. What do you do?",
        prompt_hi="आपको एक तंग बाज़ार गली से पीछे निकालना है। शीशों में गाड़ी के ठीक पीछे की ज़मीन नहीं दिखती। आप क्या करेंगे?",
        scene_env="residential_street",
        actors=[
            Actor(id="kid_hidden", kind="pedestrian", asset="ped_child", meta={"occluded": True},
                  path=[[0, -1, 0, -4], [5, 1, 0, -4]]),
        ],
        camera=[CameraKeyframe(t=0.0, position=[0, 1.6, 4], look_at=[0, 0, -6])],
        options=[
            Option(id="a", label="Get out and check behind the vehicle first, then reverse slowly",
                   label_hi="पहले उतरकर गाड़ी के पीछे देखें, फिर धीरे-धीरे पीछे लें"),
            Option(id="b", label="Reverse slowly with the horn sounding — anyone there will move",
                   label_hi="हॉर्न बजाते हुए धीरे-धीरे पीछे लें — जो होगा वह हट जाएगा"),
            Option(id="c", label="Ask a bystander to wave you back and rely on them",
                   label_hi="किसी राहगीर से इशारा करने को कहें और उसी पर भरोसा करें"),
        ],
        correct_option_id="a",
        explanation="A small child is exactly the height your mirrors cannot show. The only "
                    "reliable check is the one you make yourself, before the wheels move.",
        mv_act_ref="Rule 17 & Section 184, MV Act 1988",
    ),

    # ----------------------------- roundabout ------------------------------
    Scenario(
        id="sc_roundabout_lane_choice_01",
        competency=Competency.ROUNDABOUT,
        difficulty=2,
        duration_s=7.5,
        prompt="You are approaching a two-lane roundabout and your exit is the third one — most of the way round. Which lane do you take?",
        prompt_hi="आप दो-लेन वाले गोल चक्कर के पास हैं और आपको तीसरे निकास से निकलना है — यानी लगभग पूरा चक्कर। आप कौन-सी लेन लेंगे?",
        scene_env="roundabout",
        actors=[Actor(id="circle", kind="marking", asset="roundabout_two_lane")],
        camera=[CameraKeyframe(t=0.0, position=[0, 2.0, -12], look_at=[0, 0, 4])],
        options=[
            Option(id="a", label="Approach in the right-hand lane, then signal left as you pass the exit before yours",
                   label_hi="दाईं लेन से आएँ, फिर अपने से पहले वाले निकास को पार करते ही बाएँ का इंडिकेटर दें"),
            Option(id="b", label="Stay in the left lane the whole way round",
                   label_hi="पूरे चक्कर में बाईं लेन में ही रहें"),
            Option(id="c", label="Pick whichever lane is emptier and change inside the roundabout",
                   label_hi="जो लेन ख़ाली हो वही लें और गोल चक्कर के भीतर लेन बदल लें"),
        ],
        correct_option_id="a",
        explanation="The left lane is for the early exits. For a late exit you take the right "
                    "lane on approach and signal left only after the exit before yours — "
                    "changing lanes inside the circle cuts across whoever is leaving.",
        mv_act_ref="Rule 12, RRR 1989",
    ),
    Scenario(
        id="sc_roundabout_blocked_01",
        competency=Competency.ROUNDABOUT,
        difficulty=2,
        duration_s=7.0,
        prompt="The roundabout is moving, but traffic is backed up solid past the exit you want. What do you do?",
        prompt_hi="गोल चक्कर चल तो रहा है, लेकिन जिस निकास से आपको जाना है वहाँ तक जाम लगा है। आप क्या करेंगे?",
        scene_env="roundabout",
        actors=[Actor(id="jam", kind="car", asset="car_queue", meta={"stationary": True})],
        camera=[CameraKeyframe(t=0.0, position=[0, 2.0, -10], look_at=[2, 0, 5])],
        options=[
            Option(id="a", label="Wait at the give-way line until there is room to clear your exit",
                   label_hi="जब तक निकास तक निकलने की जगह न बने, रास्ता-दें रेखा पर ही रुकें"),
            Option(id="b", label="Enter anyway to hold your place in the queue",
                   label_hi="फिर भी घुस जाएँ ताकि क़तार में जगह बनी रहे"),
            Option(id="c", label="Enter and take an earlier exit, then come back round",
                   label_hi="घुसकर पहले वाले निकास से निकलें, फिर दोबारा चक्कर लगाएँ"),
        ],
        correct_option_id="a",
        explanation="Entering with nowhere to go leaves you stopped inside the circle, "
                    "blocking every other arm. Do not enter a junction you cannot clear.",
        mv_act_ref="Rule 12 & Rule 14, RRR 1989",
    ),

    # ----------------------------- overtaking ------------------------------
    Scenario(
        id="sc_overtake_blind_curve_01",
        competency=Competency.OVERTAKING,
        difficulty=2,
        duration_s=7.0,
        prompt="A slow tractor is ahead of you on a hill road, and the way forward bends out of sight around a rock face. What do you do?",
        prompt_hi="पहाड़ी सड़क पर आपके आगे धीमा ट्रैक्टर है, और आगे का रास्ता चट्टान के मोड़ पर नज़रों से ओझल है। आप क्या करेंगे?",
        scene_env="two_lane_highway",
        actors=[
            Actor(id="tractor", kind="tractor", asset="tractor", meta={"speed_kmph": 18}),
            Actor(id="bend", kind="terrain", asset="blind_curve"),
        ],
        camera=[CameraKeyframe(t=0.0, position=[0, 1.6, -10], look_at=[1, 0, 8])],
        options=[
            Option(id="a", label="Stay behind until the road opens up and you can see the whole overtake",
                   label_hi="तब तक पीछे रहें जब तक रास्ता खुल न जाए और पूरा ओवरटेक दिखाई न दे"),
            Option(id="b", label="Overtake now — the tractor is slow and you will be quick",
                   label_hi="अभी ओवरटेक करें — ट्रैक्टर धीमा है और आप जल्दी निकल जाएँगे"),
            Option(id="c", label="Sound the horn into the curve first, then overtake",
                   label_hi="पहले मोड़ की ओर हॉर्न बजाएँ, फिर ओवरटेक करें"),
        ],
        correct_option_id="a",
        explanation="Overtaking is prohibited wherever you cannot see the road ahead to be "
                    "clear — a bend, a crest, a narrow bridge. A horn does not make an "
                    "oncoming vehicle you cannot see disappear.",
        mv_act_ref="Rule 11, RRR 1989",
    ),
    Scenario(
        id="sc_overtake_horn_ok_01",
        competency=Competency.OVERTAKING,
        difficulty=3,
        duration_s=7.5,
        prompt="A loaded truck ahead has 'Horn OK Please' painted on its tailboard, and the driver waves a hand out of the window. What do you do?",
        prompt_hi="आगे लदे ट्रक के पीछे 'Horn OK Please' लिखा है, और चालक खिड़की से हाथ हिलाता है। आप क्या करेंगे?",
        scene_env="two_lane_highway",
        actors=[
            Actor(id="truck", kind="truck", asset="truck_loaded", meta={"tailboard": "Horn OK Please"}),
        ],
        camera=[CameraKeyframe(t=0.0, position=[0, 1.6, -11], look_at=[0, 0, 8])],
        options=[
            Option(id="a", label="Overtake only when you can see the road ahead is clear yourself",
                   label_hi="तभी ओवरटेक करें जब आप ख़ुद देख लें कि आगे रास्ता साफ़ है"),
            Option(id="b", label="Take the wave as a signal that it is safe and pull out",
                   label_hi="हाथ के इशारे को सुरक्षित मानकर बाहर निकल जाएँ"),
            Option(id="c", label="Sound the horn twice and overtake, as the tailboard invites",
                   label_hi="दो बार हॉर्न बजाकर ओवरटेक करें, जैसा पीछे लिखा है"),
        ],
        correct_option_id="a",
        explanation="Painted text is not a rule and another driver's wave is not permission. "
                    "The truck blocks the view that the decision depends on, so the overtake "
                    "is yours to judge only once you can see past it.",
        mv_act_ref="Rule 10 & Rule 11, RRR 1989",
    ),

    # ----------------------------- emergency vehicle -----------------------
    Scenario(
        id="sc_emerg_ambulance_queue_01",
        competency=Competency.EMERGENCY_VEHICLE,
        difficulty=3,
        duration_s=8.0,
        prompt="An ambulance is behind you with its siren on, but you are in a stopped queue at a red signal. What do you do?",
        prompt_hi="आपके पीछे सायरन बजाती एम्बुलेंस है, लेकिन आप लाल सिग्नल पर रुकी क़तार में हैं। आप क्या करेंगे?",
        scene_env="urban_intersection",
        actors=[
            Actor(id="amb", kind="ambulance", asset="ambulance", meta={"siren": True},
                  path=[[0, 0, 0, -14], [6, 0, 0, -3]]),
            Actor(id="signal", kind="signal", asset="traffic_light", meta={"state": "red"}),
        ],
        camera=[CameraKeyframe(t=0.0, position=[0, 1.6, -6], look_at=[0, 0, 6])],
        options=[
            Option(id="a", label="Move aside within your lane to open a gap, without entering the junction against the red",
                   label_hi="लाल सिग्नल तोड़े बिना, अपनी लेन में किनारे होकर रास्ता बनाएँ"),
            Option(id="b", label="Jump the red signal to get out of the way",
                   label_hi="रास्ता देने के लिए लाल सिग्नल तोड़ दें"),
            Option(id="c", label="Stay exactly where you are — the signal is red for everyone",
                   label_hi="जहाँ हैं वहीं रुके रहें — सिग्नल सबके लिए लाल है"),
        ],
        correct_option_id="a",
        explanation="Giving way never requires you to create a second emergency. Make room "
                    "where you are — edge aside, close up, leave a channel — rather than "
                    "entering cross traffic that has a green.",
        mv_act_ref="Rule 9 & Section 119, MV Act 1988",
    ),
    Scenario(
        id="sc_emerg_oncoming_01",
        competency=Competency.EMERGENCY_VEHICLE,
        difficulty=2,
        duration_s=7.0,
        prompt="On an undivided road, an ambulance is coming towards you with its siren on while overtaking a line of traffic. What do you do?",
        prompt_hi="बिना डिवाइडर वाली सड़क पर सामने से सायरन बजाती एम्बुलेंस ट्रैफ़िक की क़तार को ओवरटेक करती हुई आ रही है। आप क्या करेंगे?",
        scene_env="two_lane_highway",
        actors=[
            Actor(id="amb_on", kind="ambulance", asset="ambulance", meta={"siren": True},
                  path=[[0, 1, 0, 20], [5, 1, 0, 2]]),
        ],
        camera=[CameraKeyframe(t=0.0, position=[0, 1.6, -8], look_at=[0, 0, 12])],
        options=[
            Option(id="a", label="Slow down and pull as far left as you safely can to widen its path",
                   label_hi="गति कम करें और सुरक्षित रूप से जितना बाएँ हो सकें हटकर उसका रास्ता चौड़ा करें"),
            Option(id="b", label="Hold your speed and position — it is on the wrong side, not you",
                   label_hi="अपनी गति और जगह बनाए रखें — ग़लत तरफ़ वह है, आप नहीं"),
            Option(id="c", label="Flash your headlights to make it pull back in",
                   label_hi="हेडलाइट फ़्लैश करें ताकि वह वापस अपनी लेन में चली जाए"),
        ],
        correct_option_id="a",
        explanation="Right of way for an ambulance applies in both directions. Slowing and "
                    "moving left costs you seconds and gives it the width it needs.",
        mv_act_ref="Rule 9, RRR 1989",
    ),

    # ----------------------------- lane discipline -------------------------
    Scenario(
        id="sc_lane_keep_left_01",
        competency=Competency.LANE_DISCIPLINE,
        difficulty=1,
        duration_s=6.0,
        prompt="You are driving well below the speed of the traffic around you on a multi-lane road. Where should you be?",
        prompt_hi="बहु-लेन सड़क पर आप आसपास के ट्रैफ़िक से काफ़ी धीमे चल रहे हैं। आपको कहाँ रहना चाहिए?",
        scene_env="multi_lane_road",
        actors=[Actor(id="faster", kind="car", asset="car_sedan", path=[[0, 3, 0, -8], [5, 3, 0, 10]])],
        camera=[CameraKeyframe(t=0.0, position=[0, 1.6, -9], look_at=[0, 0, 8])],
        options=[
            Option(id="a", label="In the leftmost lane, leaving the right lanes for faster traffic and overtaking",
                   label_hi="सबसे बाईं लेन में, दाईं लेनें तेज़ ट्रैफ़िक और ओवरटेक के लिए छोड़ दें"),
            Option(id="b", label="In the right lane, where you are away from entering traffic",
                   label_hi="दाईं लेन में, जहाँ आप आने-जाने वाले ट्रैफ़िक से दूर रहें"),
            Option(id="c", label="In the middle lane, so vehicles can pass on either side",
                   label_hi="बीच वाली लेन में, ताकि वाहन दोनों ओर से निकल सकें"),
        ],
        correct_option_id="a",
        explanation="Keep left unless overtaking. A slow vehicle sitting in a right lane "
                    "forces everyone else to pass on the left, which is where the danger is.",
        mv_act_ref="Rule 2 & Rule 10, RRR 1989",
    ),
    Scenario(
        id="sc_lane_wrong_way_01",
        competency=Competency.LANE_DISCIPLINE,
        difficulty=3,
        duration_s=7.0,
        prompt="A two-wheeler is riding straight towards you on your own side of a divided road, against the traffic. What do you do?",
        prompt_hi="डिवाइडर वाली सड़क पर एक दोपहिया आपकी ही तरफ़, ट्रैफ़िक के विरुद्ध, सीधे आपकी ओर आ रहा है। आप क्या करेंगे?",
        scene_env="multi_lane_road",
        actors=[
            Actor(id="wrongway", kind="two_wheeler", asset="motorcycle", meta={"wrong_side": True},
                  path=[[0, 0, 0, 16], [5, 0, 0, 2]]),
        ],
        camera=[CameraKeyframe(t=0.0, position=[0, 1.6, -8], look_at=[0, 0, 10])],
        options=[
            Option(id="a", label="Slow down, move left, and let them pass — do not argue for the right of way",
                   label_hi="गति कम करें, बाएँ हटें और उन्हें निकलने दें — अधिकार की बहस न करें"),
            Option(id="b", label="Hold your lane and flash your lights until they move",
                   label_hi="अपनी लेन में डटे रहें और लाइट फ़्लैश करते रहें जब तक वे न हटें"),
            Option(id="c", label="Swing right to go around them",
                   label_hi="उन्हें बचाकर दाईं ओर से निकल जाएँ"),
        ],
        correct_option_id="a",
        explanation="Being right does not stop a collision. Slow, keep left, and give them "
                    "room; swinging right puts you into the lane the rest of the traffic is "
                    "legitimately using.",
        mv_act_ref="Rule 2 & Section 184, MV Act 1988",
    ),
    Scenario(
        id="sc_lane_solid_line_01",
        competency=Competency.LANE_DISCIPLINE,
        difficulty=2,
        duration_s=6.5,
        prompt="A solid white line runs between your lane and the next. The vehicle ahead is slow. What does the line mean for you?",
        prompt_hi="आपकी लेन और अगली लेन के बीच लगातार सफ़ेद रेखा है। आगे वाला वाहन धीमा है। यह रेखा आपके लिए क्या मायने रखती है?",
        scene_env="multi_lane_road",
        actors=[Actor(id="line", kind="marking", asset="solid_white_line")],
        camera=[CameraKeyframe(t=0.0, position=[0, 1.5, -8], look_at=[0, 0, 9])],
        options=[
            Option(id="a", label="Stay in your lane — a solid line must not be crossed",
                   label_hi="अपनी लेन में ही रहें — लगातार रेखा पार नहीं की जा सकती"),
            Option(id="b", label="Cross it briefly, as long as the overtake is quick",
                   label_hi="थोड़ी देर के लिए पार कर लें, बशर्ते ओवरटेक जल्दी हो"),
            Option(id="c", label="Cross it if no vehicle is visible in the next lane",
                   label_hi="अगर अगली लेन में कोई वाहन न दिखे तो पार कर लें"),
        ],
        correct_option_id="a",
        explanation="A solid line marks a stretch where changing lanes has been judged "
                    "unsafe — poor sightlines, a merge, a bend. It is not advisory, and an "
                    "empty-looking lane is exactly what it is there to protect you from.",
        mv_act_ref="Rule 2 & Schedule of road markings, RRR 1989",
    ),

    # ----------------------------- sign recognition ------------------------
    Scenario(
        id="sc_sign_giveway_01",
        competency=Competency.SIGN_RECOGNITION,
        difficulty=1,
        duration_s=5.5,
        prompt="You approach a downward-pointing red-bordered triangle at a junction. What does it require?",
        prompt_hi="चौराहे पर आपको नीचे की ओर इशारा करता लाल किनारी वाला त्रिकोण दिखता है। यह क्या कहता है?",
        scene_env="urban_intersection",
        actors=[Actor(id="sign_gw", kind="sign", asset="sign_give_way", meta={"sign": "GIVE_WAY"})],
        camera=[CameraKeyframe(t=0.0, position=[0, 1.5, -7], look_at=[1, 1, 5])],
        options=[
            Option(id="a", label="Slow down and give way to traffic on the road you are joining, stopping if needed",
                   label_hi="गति कम करें और जिस सड़क पर जा रहे हैं उसके ट्रैफ़िक को रास्ता दें, ज़रूरत हो तो रुकें"),
            Option(id="b", label="Come to a complete stop every time, even on an empty road",
                   label_hi="हर बार पूरी तरह रुकें, चाहे सड़क ख़ाली ही क्यों न हो"),
            Option(id="c", label="Carry on — it is a warning of a junction ahead",
                   label_hi="चलते रहें — यह आगे चौराहे की चेतावनी भर है"),
        ],
        correct_option_id="a",
        explanation="Give Way means yield: slow, be ready to stop, and enter only when you "
                    "will not make crossing traffic alter its speed or line. A mandatory "
                    "full stop is the octagonal STOP sign, not this one.",
        mv_act_ref="Rule 3 & Section 119, MV Act 1988",
    ),
    Scenario(
        id="sc_sign_nohorn_01",
        competency=Competency.SIGN_RECOGNITION,
        difficulty=1,
        duration_s=5.5,
        prompt="A circular sign with a red border shows a horn crossed out, on the road past a hospital. What does it mean?",
        prompt_hi="अस्पताल के पास सड़क पर लाल किनारी वाले गोल चिह्न में हॉर्न पर काट का निशान है। इसका क्या मतलब है?",
        scene_env="urban_road",
        actors=[Actor(id="sign_nh", kind="sign", asset="sign_no_horn", meta={"sign": "NO_HORN"})],
        camera=[CameraKeyframe(t=0.0, position=[0, 1.5, -7], look_at=[1, 1, 5])],
        options=[
            Option(id="a", label="Use of the horn is prohibited on this stretch",
                   label_hi="इस हिस्से में हॉर्न बजाना मना है"),
            Option(id="b", label="Use the horn only in an emergency, at any volume",
                   label_hi="केवल आपात स्थिति में, किसी भी आवाज़ में हॉर्न बजाएँ"),
            Option(id="c", label="A warning that vehicles ahead may sound their horns",
                   label_hi="चेतावनी कि आगे वाहन हॉर्न बजा सकते हैं"),
        ],
        correct_option_id="a",
        explanation="A red circle with a bar is a prohibition, not advice. Silence zones are "
                    "marked around hospitals and schools, and the horn stays off there.",
        mv_act_ref="Rule 21 & Section 194F, MV Act 1988",
    ),

    # ----------------------------- hazard anticipation ---------------------
    Scenario(
        id="sc_hazard_speedbreaker_01",
        competency=Competency.HAZARD_ANTICIPATION,
        difficulty=2,
        duration_s=6.5,
        prompt="Vehicles ahead of you are braking sharply for an unmarked, unpainted speed breaker you have only just seen. What do you do?",
        prompt_hi="आगे के वाहन एक बिना निशान, बिना रंग वाले स्पीड ब्रेकर के लिए ज़ोर से ब्रेक लगा रहे हैं, जो आपको अभी दिखा है। आप क्या करेंगे?",
        scene_env="residential_street",
        actors=[
            Actor(id="hump", kind="obstacle", asset="speed_breaker", meta={"marked": False}),
            Actor(id="ahead", kind="car", asset="car_hatch", meta={"braking": True}),
        ],
        camera=[CameraKeyframe(t=0.0, position=[0, 1.5, -9], look_at=[0, 0, 7])],
        options=[
            Option(id="a", label="Brake early and smoothly, keeping a gap from the vehicle ahead, and cross it slowly",
                   label_hi="जल्दी और धीरे-धीरे ब्रेक लगाएँ, आगे वाले से दूरी रखें, और धीमे-धीमे पार करें"),
            Option(id="b", label="Brake hard at the last moment to keep your place in the traffic",
                   label_hi="ट्रैफ़िक में जगह बनाए रखने के लिए आख़िरी क्षण में ज़ोर से ब्रेक लगाएँ"),
            Option(id="c", label="Steer onto the shoulder to go round the end of the breaker",
                   label_hi="ब्रेकर के किनारे से बचकर निकलने के लिए सड़क के किनारे उतर जाएँ"),
        ],
        correct_option_id="a",
        explanation="The hazard is not only the hump but the traffic reacting to it. Braking "
                    "early leaves room for whoever is behind you; the shoulder is where "
                    "pedestrians and parked vehicles are.",
        mv_act_ref="Section 112 & Section 184, MV Act 1988",
    ),
    Scenario(
        id="sc_hazard_cattle_01",
        competency=Competency.HAZARD_ANTICIPATION,
        difficulty=2,
        duration_s=7.0,
        prompt="Cattle are standing and moving loosely across a highway lane ahead of you. What do you do?",
        prompt_hi="आगे हाईवे की लेन में मवेशी खड़े हैं और इधर-उधर घूम रहे हैं। आप क्या करेंगे?",
        scene_env="two_lane_highway",
        actors=[
            Actor(id="cow1", kind="animal", asset="cattle", path=[[0, -2, 0, 12], [7, 2, 0, 12]]),
            Actor(id="cow2", kind="animal", asset="cattle", meta={"stationary": True}),
        ],
        camera=[CameraKeyframe(t=0.0, position=[0, 1.6, -12], look_at=[0, 0, 10])],
        options=[
            Option(id="a", label="Slow well down and pass wide only when you can see the whole group is settled",
                   label_hi="काफ़ी गति कम करें और तभी दूरी रखकर निकलें जब पूरा झुंड शांत दिखे"),
            Option(id="b", label="Sound the horn to move them off the road, then drive through",
                   label_hi="हॉर्न बजाकर उन्हें हटाएँ, फिर निकल जाएँ"),
            Option(id="c", label="Keep your speed and steer around the gap between them",
                   label_hi="गति बनाए रखें और उनके बीच की जगह से निकल जाएँ"),
        ],
        correct_option_id="a",
        explanation="A horn scatters animals unpredictably, often into your path, and a calf "
                    "usually follows the one that bolts. Slow to a speed you can stop from "
                    "and give the whole group room.",
        mv_act_ref="Section 112 & Section 184, MV Act 1988",
    ),

    # ----------------------------- night & weather -------------------------
    Scenario(
        id="sc_night_dazzle_01",
        competency=Competency.NIGHT_WEATHER,
        difficulty=2,
        duration_s=7.0,
        prompt="An oncoming vehicle keeps its high beam on and you are dazzled. What do you do?",
        prompt_hi="सामने से आ रहा वाहन हाई बीम जलाए रखता है और आपकी आँखें चौंधिया जाती हैं। आप क्या करेंगे?",
        scene_env="night_highway",
        actors=[
            Actor(id="dazzler", kind="car", asset="car_sedan", meta={"high_beam": True},
                  path=[[0, 1, 0, 25], [6, 1, 0, 0]]),
        ],
        camera=[CameraKeyframe(t=0.0, position=[0, 1.5, -8], look_at=[0, 0, 14])],
        options=[
            Option(id="a", label="Slow down, look towards the left edge of the road, and keep your own low beam on",
                   label_hi="गति कम करें, सड़क के बाएँ किनारे की ओर देखें, और अपनी लो बीम जलाए रखें"),
            Option(id="b", label="Switch to high beam as well so you can see through it",
                   label_hi="आप भी हाई बीम कर लें ताकि देख सकें"),
            Option(id="c", label="Close your eyes for a moment until the vehicle passes",
                   label_hi="वाहन के निकलने तक एक पल के लिए आँखें बंद कर लें"),
        ],
        correct_option_id="a",
        explanation="Looking at the left edge keeps you tracking the road while the glare "
                    "passes. Answering with your own high beam blinds them too, which leaves "
                    "two blinded drivers closing on each other.",
        mv_act_ref="Rule 20, RRR 1989",
    ),
    Scenario(
        id="sc_rain_standing_water_01",
        competency=Competency.NIGHT_WEATHER,
        difficulty=3,
        duration_s=7.5,
        prompt="Heavy monsoon rain has left a long sheet of standing water across the road ahead. What do you do?",
        prompt_hi="तेज़ मानसूनी बारिश से आगे सड़क पर लंबे हिस्से में पानी भर गया है। आप क्या करेंगे?",
        scene_env="urban_road",
        actors=[
            Actor(id="water", kind="hazard", asset="standing_water", meta={"depth_cm": 15}),
        ],
        camera=[CameraKeyframe(t=0.0, position=[0, 1.5, -10], look_at=[0, 0, 9])],
        options=[
            Option(id="a", label="Slow down before you reach it, drive through steadily in a low gear, then dry the brakes with a gentle press",
                   label_hi="पानी से पहले ही गति कम करें, नीचे गियर में एक-सी रफ़्तार से निकलें, फिर हल्का ब्रेक दबाकर ब्रेक सुखाएँ"),
            Option(id="b", label="Accelerate through so you cross it quickly",
                   label_hi="तेज़ी से निकल जाएँ ताकि जल्दी पार हो जाए"),
            Option(id="c", label="Brake hard in the middle of the water to test your grip",
                   label_hi="पकड़ जाँचने के लिए पानी के बीच में ज़ोर से ब्रेक लगाएँ"),
        ],
        correct_option_id="a",
        explanation="Speed on standing water lifts the tyres off the surface and you steer "
                    "nothing. Slow before, hold a steady low gear through, and expect the "
                    "brakes to bite late until a light press has dried them.",
        mv_act_ref="Section 112 & Section 184, MV Act 1988",
    ),
]


def scenario_by_id(sid: str) -> Scenario | None:
    return next((s for s in SCENARIOS if s.id == sid), None)


def sanity_check() -> None:
    """
    Guards the bank's two invariants. Asserted by the test suite so a bad
    seed edit fails loudly instead of silently degrading a live test.
    """
    from .models import QUESTIONS_PER_TEST, Competency as _C

    ids = [s.id for s in SCENARIOS]
    assert len(ids) == len(set(ids)), "duplicate scenario ids in the bank"
    assert len(SCENARIOS) >= QUESTIONS_PER_TEST, (
        f"bank has {len(SCENARIOS)} scenarios; a test needs "
        f"{QUESTIONS_PER_TEST} unique ones"
    )
    for s in SCENARIOS:
        opt_ids = [o.id for o in s.options]
        assert len(opt_ids) == len(set(opt_ids)), f"{s.id}: duplicate option ids"
        assert s.correct_option_id in opt_ids, (
            f"{s.id}: correct_option_id {s.correct_option_id!r} is not an option"
        )
    covered = {s.competency for s in SCENARIOS}
    missing = set(_C) - covered
    assert not missing, f"competencies with no scenarios: {sorted(c.value for c in missing)}"
