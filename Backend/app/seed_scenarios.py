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
