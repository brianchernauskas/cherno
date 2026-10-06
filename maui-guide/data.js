/* ==========================================================================
   Maui trip data. Everything the guide renders comes from this file.
   Drive times are curated estimates for normal daytime traffic — see README.
   ========================================================================== */

export const TRIP = {
  title: 'Maui',
  travelers: ['Brian', 'Amanda'],
  start: '2026-08-28T10:52:00-07:00', // PHX departure
  end:   '2026-09-05T22:00:00-10:00', // OGG departure
};

/* Home bases. `key` is used throughout to pick which distance column to show. */
export const BASES = [
  {
    key: 'kaanapali',
    name: 'Hyatt Regency Maui',
    short: 'Kāʻanapali',
    region: 'West Maui',
    address: '200 Nohea Kai Dr, Lahaina, HI 96761',
    phone: '+18086611234',
    phoneLabel: '(808) 661-1234',
    lat: 20.9160, lon: -156.6939,
    checkIn: '2026-08-28', checkOut: '2026-09-01',
    checkInTime: '4:00 pm', checkOutTime: '11:00 am',
    room: 'Ocean-View Room · One King',
    perks: [
      'Daily buffet breakfast for two',
      'Resort fee waived',
      '$300 resort credit',
      '$50 resort credit',
    ],
    note: 'Two separate resort credits — $350 total. Ask at check-in how they post and whether they stack on one folio.',
    accent: '#e8703a',
  },
  {
    key: 'wailea',
    name: 'Grand Wailea',
    short: 'Wailea',
    region: 'South Maui',
    address: '3850 Wailea Alanui Dr, Wailea, HI 96753',
    phone: '+18088751234',
    phoneLabel: '(808) 875-1234',
    lat: 20.6862, lon: -156.4423,
    checkIn: '2026-09-01', checkOut: '2026-09-05',
    checkInTime: '4:00 pm', checkOutTime: '11:00 am',
    room: 'Ocean-View Room · One King',
    perks: [
      '$240 digital Costco Shop Card',
      'Resort fee included',
    ],
    note: 'Shop Card arrives by email ~10 days after the trip starts, to your gmail.',
    accent: '#2f8f8a',
  },
];

/* --------------------------------------------------------------------------
   Itinerary. `lock: true` marks a fixed commitment; everything else is open.
   -------------------------------------------------------------------------- */
export const DAYS = [
  {
    date: '2026-08-28', label: 'Fri', title: 'Fly day → Kāʻanapali', base: 'kaanapali',
    events: [
      { time: '08:45', tz: 'PHX', kind: 'ride', lock: true, title: 'Uber to PHX',
        detail: 'Reserved pickup. Allow for a Friday-morning I-10.' },
      { time: '10:52', tz: 'PHX', kind: 'flight', lock: true, title: 'AA 645 · PHX → OGG',
        detail: 'Airbus A321neo · 6h 27m · arrives 2:19 pm Maui time', vault: 'flightOut' },
      { time: '15:19', tz: 'HST', kind: 'car', lock: true, title: 'Rental car pickup — Kahului',
        detail: 'Full-size, Toyota Camry or similar. 101 Mayor Elmer F Cravalho Way.', vault: 'car' },
      { time: '16:00', tz: 'HST', kind: 'hotel', lock: true, title: 'Check in — Hyatt Regency Maui',
        detail: '~50 min / 28 mi from the airport. Ocean-view king.', vault: 'hotel1' },
      { time: '18:30', tz: 'HST', kind: 'idea', title: 'Easy first night',
        detail: 'Sunset is ~6:47. Walk to Whalers Village — Monkeypod or Leilani\'s. Nothing ambitious after a 6-hour flight.' },
    ],
  },
  {
    date: '2026-08-29', label: 'Sat', title: 'West Maui + Duke\'s', base: 'kaanapali',
    events: [
      { time: '07:00', tz: 'HST', kind: 'idea', title: 'Snorkel Black Rock',
        detail: 'Puʻu Kekaʻa is a 10-min walk up the beach. Best visibility before 9 am, before the wind comes up. Turtles are common on the north side.' },
      { time: '11:00', tz: 'HST', kind: 'idea', title: 'Napili / Kapalua drift',
        detail: 'Napili Bay for the crescent, Kapalua Bay for the calmest water on this coast. Both under 20 min north.' },
      { time: '18:30', tz: 'HST', kind: 'dining', lock: true, title: 'Duke\'s Beach House',
        detail: 'Table for 2 · 130 Kai Malina Pkwy, Honua Kai. Free self-park — get a placard from the valet attendant.',
        vault: 'dukes', phone: '+18086622900' },
    ],
  },
  {
    date: '2026-08-30', label: 'Sun', title: 'North shore or slow day', base: 'kaanapali',
    events: [
      { time: '09:00', tz: 'HST', kind: 'idea', title: 'Option A — Kahekili / north coast loop',
        detail: 'Nakalele Blowhole, Olivine Pools, the Dragon\'s Teeth at Kapalua. Road narrows to one lane past mile 38. Not for the nervous.' },
      { time: '09:00', tz: 'HST', kind: 'idea', title: 'Option B — Do nothing',
        detail: 'You have $350 in resort credit and a beach out front. This is a legitimate plan.' },
      { time: '15:00', tz: 'HST', kind: 'idea', title: 'Happy hour crawl',
        detail: 'Whalers Village has three good ones within 200 yards of each other.' },
    ],
  },
  {
    date: '2026-08-31', label: 'Mon', title: 'Last West Maui day', base: 'kaanapali',
    events: [
      { time: '08:00', tz: 'HST', kind: 'idea', title: 'Honolua Bay',
        detail: 'Best snorkel on this side when it\'s flat — a marine preserve. Short walk in through the trees. Rocky entry, wear something on your feet.' },
      { time: '16:00', tz: 'HST', kind: 'todo', title: 'Burn the resort credit',
        detail: 'Last full night here. Anything unspent disappears at checkout.' },
    ],
  },
  {
    date: '2026-09-01', label: 'Tue', title: 'Move to Wailea', base: 'wailea', transition: true,
    events: [
      { time: '11:00', tz: 'HST', kind: 'hotel', lock: true, title: 'Check out — Hyatt Regency' },
      { time: '11:30', tz: 'HST', kind: 'idea', title: 'Drive south, stop on the way',
        detail: '~55 min direct. Worth breaking up: Olowalu turtle reef at mile 14, or Maui Ocean Center at Māʻalaea.' },
      { time: '16:00', tz: 'HST', kind: 'hotel', lock: true, title: 'Check in — Grand Wailea',
        detail: 'Ocean-view king.', vault: 'hotel2' },
    ],
  },
  {
    date: '2026-09-02', label: 'Wed', title: 'Sunset sail', base: 'wailea',
    events: [
      { time: '09:00', tz: 'HST', kind: 'idea', title: 'Keep the morning light',
        detail: 'Big Beach or Maluaka — both under 15 min. Be back by 2:30 to change.' },
      { time: '15:45', tz: 'HST', kind: 'boat', lock: true, title: 'Kai Kanani Adventure Sunset Sail',
        detail: 'Two adults. Loads on the beach at Maluaka — wear clothes you don\'t mind getting wet.',
        vault: 'sail', phone: '+18088797218', flag: 'sailTime' },
    ],
  },
  {
    date: '2026-09-03', label: 'Thu', title: 'Big day — pick one', base: 'wailea',
    events: [
      { time: '03:00', tz: 'HST', kind: 'idea', title: 'Option A — Haleakalā sunrise',
        detail: '~2 hr drive, and reservations are required for sunrise entry (recreation.gov, released 60 days out + a 48-hour batch). It is near-freezing at the summit. Sunset needs no reservation and is far easier.' },
      { time: '08:00', tz: 'HST', kind: 'idea', title: 'Option B — Road to Hāna',
        detail: '~3 hr each way from Wailea, all day, and you finish it tired. Doable but it eats the day.' },
      { time: '09:00', tz: 'HST', kind: 'idea', title: 'Option C — Upcountry',
        detail: 'Makawao, Kula, lavender farm, Surfing Goat Dairy. Cool air, ~45 min, home by mid-afternoon. The best value-per-hour on the island.' },
    ],
  },
  {
    date: '2026-09-04', label: 'Fri', title: 'Last full day', base: 'wailea',
    events: [
      { time: '09:00', tz: 'HST', kind: 'idea', title: 'South Maui beach tour',
        detail: 'Ulua for snorkel, Keawakapu for swimming, Big Beach for the spectacle. All within 15 min.' },
      { time: '17:00', tz: 'HST', kind: 'idea', title: 'Last sunset',
        detail: 'Wailea Beach Path runs 1.5 miles along the water. Walk it at 6:30.' },
    ],
  },
  {
    date: '2026-09-05', label: 'Sat', title: 'Departure day', base: 'wailea',
    events: [
      { time: '11:00', tz: 'HST', kind: 'hotel', lock: true, title: 'Check out — Grand Wailea',
        detail: 'You have a 10 pm flight. Ask about late checkout or bag storage; the resort has day-use showers.' },
      { time: '20:00', tz: 'HST', kind: 'car', lock: true, title: 'Rental car drop-off — Kahului',
        detail: 'Same location as pickup. ~30 min from Wailea.', vault: 'car' },
      { time: '22:00', tz: 'HST', kind: 'flight', lock: true, title: 'AA 432 · OGG → PHX',
        detail: 'Red-eye · 5h 44m · arrives 6:44 am Sunday', vault: 'flightBack' },
    ],
  },
];

/* --------------------------------------------------------------------------
   Points of interest. dist = [miles, minutes] driving from each base.
   -------------------------------------------------------------------------- */
export const SPOTS = [
  { id:'blackrock', name:'Puʻu Kekaʻa (Black Rock)', cat:'snorkel', lat:20.9280, lon:-156.6950,
    blurb:'The lava headland at the north end of Kāʻanapali Beach. Sheltered water, reef fish, and turtles most mornings.',
    tip:'Walk, don\'t drive. Go before 9 am — afternoon wind kills the visibility. Cliff divers at sunset.',
    dist:{ kaanapali:[0.6, 10], wailea:[36, 62] }, walkFrom:'kaanapali' },

  { id:'whalers', name:'Whalers Village', cat:'town', lat:20.9235, lon:-156.6944,
    blurb:'Open-air mall on the beach path — shops, a whale museum, and three of the better West Maui happy hours in one place.',
    tip:'Validated parking if you buy anything. The beach path runs right through it.',
    dist:{ kaanapali:[0.3, 6], wailea:[36, 62] }, walkFrom:'kaanapali' },

  { id:'lahaina', name:'Lahaina Town', cat:'town', lat:20.8783, lon:-156.6825,
    blurb:'Historic whaling town, devastated by the August 2023 fire. Front Street has been reopening in stages; the banyan tree survived and has releafed.',
    tip:'Check what is actually open before going, and treat it as a working recovery zone, not a stop on a tour. Spend money at the businesses that are back.',
    dist:{ kaanapali:[4.5, 12], wailea:[32, 55] }, sensitive:true },

  { id:'napili', name:'Napili Bay', cat:'beach', lat:20.9950, lon:-156.6680,
    blurb:'A near-perfect crescent of sand with reef on both points. Smaller and quieter than Kāʻanapali.',
    tip:'Parking is scarce and mostly resort-owned. Two small public access paths off Napili Pl and Hui Dr.',
    dist:{ kaanapali:[6.5, 16], wailea:[42, 72] } },

  { id:'kapalua', name:'Kapalua Bay', cat:'snorkel', lat:21.0016, lon:-156.6570,
    blurb:'Protected on both sides by lava points, which makes it the calmest snorkel water in West Maui.',
    tip:'Good for a nervous swimmer. Small lot fills before 9 am.',
    dist:{ kaanapali:[8.5, 20], wailea:[44, 75] } },

  { id:'honolua', name:'Honolua Bay', cat:'snorkel', lat:21.0140, lon:-156.6386,
    blurb:'Marine life conservation district. When it is flat, the best snorkeling on this side of the island.',
    tip:'Park on the highway shoulder, walk 10 min through jungle. Entry is over rounded boulders — bring reef shoes. In winter it is a surf break, not a snorkel spot.',
    dist:{ kaanapali:[11, 25], wailea:[46, 80] } },

  { id:'nakalele', name:'Nakalele Blowhole', cat:'scenic', lat:21.0269, lon:-156.5892,
    blurb:'Sea geyser firing through a lava tube on the wild north coast, plus a heart-shaped hole in the rock nearby.',
    tip:'Steep unmarked scramble down. People have been killed here — stay well back from the hole itself. Road past here narrows to one lane.',
    dist:{ kaanapali:[17, 40], wailea:[52, 95] }, caution:true },

  { id:'dragons', name:'Dragon\'s Teeth', cat:'scenic', lat:21.0043, lon:-156.6455,
    blurb:'Wind-carved lava spikes on Makaluapuna Point, next to a labyrinth walking path.',
    tip:'Five-minute walk from the Ritz beach lot. It is also a burial site — stay on the path and off the teeth.',
    dist:{ kaanapali:[9, 21], wailea:[45, 77] }, sensitive:true },

  { id:'olowalu', name:'Olowalu Reef', cat:'snorkel', lat:20.8083, lon:-156.6180,
    blurb:'Turtle cleaning station at mile marker 14. Shallow coral garden straight off the roadside.',
    tip:'Swim out past the shallow rubble to reach live coral. Zero facilities — it is literally a spot on the highway.',
    dist:{ kaanapali:[12, 20], wailea:[22, 35] } },

  { id:'oceancenter', name:'Maui Ocean Center', cat:'landmark', lat:20.7920, lon:-156.5108,
    blurb:'Aquarium at Māʻalaea built entirely around Hawaiian species, with a good living-reef exhibit and shark tunnel.',
    tip:'Sits almost exactly halfway between your two hotels — the natural stop on move day.',
    dist:{ kaanapali:[20, 32], wailea:[14, 22] } },

  { id:'iao', name:'ʻĪao Valley State Park', cat:'scenic', lat:20.8817, lon:-156.5450,
    blurb:'The 1,200-ft ʻĪao Needle in a green-walled valley that gets 300+ inches of rain a year. Also the site of the 1790 battle of Kepaniwai.',
    tip:'Non-residents must reserve parking online in advance. Short paved walk. Go early — clouds fill the valley by midday.',
    dist:{ kaanapali:[26, 45], wailea:[22, 38] }, reserve:true },

  { id:'paia', name:'Pāʻia', cat:'town', lat:20.9046, lon:-156.3697,
    blurb:'Old sugar town turned surf town. One block of good food, a fish market, and the gateway to the Hāna highway.',
    tip:'Mama\'s Fish House is 2 min east and books months out. Paia Fish Market is the walk-in alternative.',
    dist:{ kaanapali:[34, 60], wailea:[25, 40] } },

  { id:'hookipa', name:'Hoʻokipa Beach', cat:'scenic', lat:20.9345, lon:-156.3563,
    blurb:'Windsurfing capital of the world, and the most reliable place on Maui to see green sea turtles hauled out on the sand.',
    tip:'Turtles come ashore late afternoon. Watch from the overlook lot — never approach within 10 feet.',
    dist:{ kaanapali:[36, 65], wailea:[27, 45] } },

  { id:'makawao', name:'Makawao', cat:'town', lat:20.8562, lon:-156.3125,
    blurb:'Upcountry paniolo (cowboy) town at 1,600 ft. Art galleries in old plantation storefronts, and cool air.',
    tip:'Komoda Store & Bakery sells out of cream puffs by mid-morning and is closed Sun/Wed.',
    dist:{ kaanapali:[38, 70], wailea:[24, 42] } },

  { id:'kula', name:'Kula / Lavender Farm', cat:'scenic', lat:20.7580, lon:-156.3300,
    blurb:'Farm country on Haleakalā\'s western slope at 3,000 ft — lavender, protea, and a view down the whole isthmus.',
    tip:'Pairs naturally with Makawao into a half-day upcountry loop. Bring a layer, it is 15°F cooler.',
    dist:{ kaanapali:[42, 78], wailea:[20, 40] } },

  { id:'haleakala', name:'Haleakalā Summit', cat:'scenic', lat:20.7097, lon:-156.2533,
    blurb:'10,023 ft. You drive from sea level to above the clouds in two hours — the steepest such road on earth.',
    tip:'Sunrise entry requires a reservation (recreation.gov, 60 days out plus a 48-hour release). Sunset needs none and is nearly as good. It is 35–45°F at the top; bring real jackets.',
    dist:{ kaanapali:[63, 165], wailea:[51, 120] }, reserve:true },

  { id:'hana', name:'Road to Hāna', cat:'scenic', lat:20.7580, lon:-155.9903,
    blurb:'620 curves, 59 one-lane bridges, waterfalls, and black sand at Waiʻānapanapa. The drive is the destination.',
    tip:'A full day, non-negotiable. Waiʻānapanapa requires an advance parking reservation. Start by 7 am, fuel up in Pāʻia, and download offline maps — there is no signal for most of it.',
    dist:{ kaanapali:[75, 260], wailea:[63, 190] }, reserve:true },

  { id:'twinfalls', name:'Twin Falls', cat:'scenic', lat:20.9120, lon:-156.2400,
    blurb:'First waterfall stop on the Hāna highway, mile marker 2. Easy enough to do on its own without committing to the whole road.',
    tip:'The honest version of "we did a waterfall" without a 10-hour day. Paid lot, short flat walk.',
    dist:{ kaanapali:[42, 75], wailea:[33, 55] } },

  { id:'waileabeach', name:'Wailea Beach', cat:'beach', lat:20.6845, lon:-156.4430,
    blurb:'The crescent directly in front of the Grand Wailea. Soft sand, gentle shore break, clean sunsets.',
    tip:'The Wailea Beach Path runs 1.5 miles north from here past four resorts. Best walk on the south side.',
    dist:{ kaanapali:[36, 62], wailea:[0.2, 4] }, walkFrom:'wailea' },

  { id:'ulua', name:'Ulua & Mokapu Beach', cat:'snorkel', lat:20.6900, lon:-156.4440,
    blurb:'The rocky point between the two coves is the most reliable snorkel entry in Wailea.',
    tip:'Small public lot off Wailea Alanui fills by 9 am. Morning is calmest.',
    dist:{ kaanapali:[36, 63], wailea:[0.8, 5] }, walkFrom:'wailea' },

  { id:'keawakapu', name:'Keawakapu Beach', cat:'beach', lat:20.7020, lon:-156.4480,
    blurb:'Long, wide, and less resort-hemmed than Wailea. Best plain swimming beach on the south shore.',
    tip:'South end lot is easiest. Sunset here is quieter than at the resorts.',
    dist:{ kaanapali:[34, 60], wailea:[2, 7] } },

  { id:'maluaka', name:'Maluaka Beach (Turtle Town)', cat:'snorkel', lat:20.6519, lon:-156.4460,
    blurb:'Reef at the south point is genuinely full of green sea turtles. Also where your sunset sail loads.',
    tip:'You will see it on Sept 2 regardless. Worth a separate morning snorkel — enter at the south end near the point.',
    dist:{ kaanapali:[40, 70], wailea:[3.5, 10] } },

  { id:'bigbeach', name:'Makena Big Beach', cat:'beach', lat:20.6320, lon:-156.4470,
    blurb:'Two-thirds of a mile of undeveloped golden sand backed by a cinder cone. The most dramatic beach on Maui.',
    tip:'The shore break is genuinely dangerous — it snaps collarbones every year. Beautiful to look at, poor to body-surf. Three lots; the first fills first.',
    dist:{ kaanapali:[41, 72], wailea:[5, 13] }, caution:true },

  { id:'laperouse', name:'La Pérouse Bay', cat:'scenic', lat:20.5960, lon:-156.4180,
    blurb:'End of the road south. Maui\'s most recent lava flow (~1790) running black into blue water. Spinner dolphins in the bay most mornings.',
    tip:'Road ends here — no services, no shade, sharp ʻaʻā lava. Do not attempt the King\'s Highway trail without real shoes and water.',
    dist:{ kaanapali:[44, 78], wailea:[8, 20] }, caution:true },

  { id:'molokini', name:'Molokini Crater', cat:'snorkel', lat:20.6314, lon:-156.4956,
    blurb:'Sunken volcanic crescent 3 miles offshore with 100+ ft visibility. Boat access only, from Māʻalaea or Kīhei.',
    tip:'First boat out gets clear water and no crowd; by 10 am there are a dozen catamarans on it. Book the earliest departure you can stand.',
    dist:{ kaanapali:[20, 32], wailea:[14, 22] }, boatOnly:true },

  { id:'kihei', name:'Kīhei', cat:'town', lat:20.7644, lon:-156.4450,
    blurb:'Where the island actually eats. Strip malls, food trucks, and the cheapest happy hours in South Maui.',
    tip:'Ten minutes north of Wailea and roughly half the price for the same drink.',
    dist:{ kaanapali:[32, 55], wailea:[5, 13] } },

  { id:'wailuku', name:'Wailuku Town', cat:'town', lat:20.8893, lon:-156.5047,
    blurb:'The county seat, and the most un-touristed real town on Maui. Market Street has good coffee and old storefronts.',
    tip:'Combine with ʻĪao Valley — it is on the way in. First Friday street party if the timing lands.',
    dist:{ kaanapali:[25, 42], wailea:[21, 36] } },
];

/* --------------------------------------------------------------------------
   Happy hours.
   `confidence`: 'good'  — corroborated across sources
                 'check' — single source, or sources disagreed; call first
   Times are 24h, Hawaii local.
   -------------------------------------------------------------------------- */
export const HAPPY = [
  // ---- West Maui ----
  { id:'monkeypod-k', name:'Monkeypod Kitchen', area:'kaanapali', where:'Whalers Village',
    lat:20.9232, lon:-156.6939, phone:'+18086626000', phoneLabel:'(808) 662-6000',
    days:'Daily', from:'15:30', to:'17:00', confidence:'good',
    prices:[ ['Draft beer','$2 off'], ['Wine by the glass','$3 off'], ['Craft cocktails','$4 off'],
             ['Appetizers','half off'], ['Wood-fired pizza','$13–16'] ],
    note:'The mai tai with the honey-lilikoʻi foam is the thing people come for. Also runs a late-night HH some nights.',
    dist:{ kaanapali:[0.3, 6], wailea:[36, 62] } },

  { id:'hulagrill', name:'Hula Grill', area:'kaanapali', where:'Whalers Village, on the sand',
    lat:20.9231, lon:-156.6948, phone:'+18086676636', phoneLabel:'(808) 667-6636',
    days:'Daily', from:'14:00', to:'16:00', confidence:'good',
    prices:[ ['Duke\'s Blonde Ale, 16oz draft','$7'], ['Cellar Pick wine','$9'],
             ['Cocktails — Lilikoʻi Mojito, Plantation Lemonade, Hale Wai','$13'],
             ['Chilled edamame, firecracker aioli','$12'], ['Fired Up shrimp cocktail','$15'],
             ['Kiawe charred ahi','$16'] ],
    note:'Toes-in-sand and first-come — no reservations. Live music runs 2–4 and again 5:30–8, with a hula show 6–7, so the happy hour and the evening set are two different rooms.',
    dist:{ kaanapali:[0.3, 6], wailea:[36, 62] } },

  { id:'leilanis', name:'Leilani\'s on the Beach', area:'kaanapali', where:'Whalers Village',
    lat:20.9229, lon:-156.6946, phone:'+18086614495', phoneLabel:'(808) 661-4495',
    days:'Mon, Thu–Sun', from:'15:00', to:'17:00', confidence:'good',
    prices:[ ['Line 39 Pinot Noir or Chardonnay, 6oz','$8'], ['Seasonal beer, 20oz','$9'],
             ['Cocktails — Kimo\'s Grog, Rum Punch, Mui Bueno, Island Time','$13'],
             ['Fire-roasted vegetable dip','$13'], ['Thai chicken skewers','$13'],
             ['Waipoli lettuce wraps','$14'], ['Prime rib poke','$15'], ['Tempura prawns','$15'] ],
    note:'Dark Tue and Wed — the only West Maui happy hour on this list that is not daily. Downstairs Beachside Grill is the casual half.',
    dist:{ kaanapali:[0.3, 6], wailea:[36, 62] } },

  { id:'mauibrewing', name:'Maui Brewing Co.', area:'kaanapali', where:'Kāʻanapali',
    lat:20.9247, lon:-156.6906, phone:'+18086694700', phoneLabel:'(808) 669-4700',
    days:'Daily', from:'15:00', to:'17:00', confidence:'good',
    prices:[ ['Draft beer','$2 off'], ['Wine by the glass','$3 off'], ['Cocktails','$4 off'],
             ['Appetizers','half off'], ['Pizza','$16'] ],
    note:'Same deal structure as Monkeypod. Brewed on-island — Bikini Blonde and Coconut Porter are the standards.',
    dist:{ kaanapali:[0.5, 7], wailea:[35, 60] } },

  { id:'pailolo', name:'Pailolo Bar & Grill', area:'kaanapali', where:'Westin Kāʻanapali Ocean Resort Villas',
    lat:20.9440, lon:-156.6890, phone:'+18086678300', phoneLabel:'(808) 667-8300',
    days:'Daily', from:'14:00', to:'18:00', confidence:'check',
    prices:[ ['Drinks and appetizers','discounted — no prices published'] ],
    note:'Four hours, the longest window on this coast and the only one still running at 5:30. Sports bar, less scene than Whalers Village. Nobody publishes the actual figures, so this one is genuinely worth a call.',
    dist:{ kaanapali:[2.8, 9], wailea:[35, 60] } },

  { id:'cliffdive', name:'Cliff Dive Grill', area:'kaanapali', where:'Sheraton Maui, at Black Rock',
    lat:20.9273, lon:-156.6944, phone:'+18086610031', phoneLabel:'(808) 661-0031',
    days:'Daily', from:'15:00', to:'17:00', confidence:'good',
    prices:[ ['Local can beers','$7'], ['Paradise Killah dragon cider','$7'], ['Draft beers','$10'],
             ['All wine','$12'], ['Blue Hawaii','$15'], ['Kāʻanapali Lemonade','$15'],
             ['Red or white sangria','$15'] ],
    note:'Sits at the base of Black Rock, with a front-row seat to the cliff-diving ceremony at sunset. Two hours, not one — an older listing had it ending at 4.',
    dist:{ kaanapali:[0.7, 10], wailea:[36, 62] } },

  { id:'lahainanoon', name:'Lahaina Noon', area:'kaanapali', where:'Royal Lahaina Resort',
    lat:20.9330, lon:-156.6895, phone:'+18086613611', phoneLabel:'(808) 661-3611',
    days:'Daily', from:'14:00', to:'16:00', confidence:'good',
    prices:[ ['All signature cocktails','$12'], ['Kāʻanapali Sunset / Poolside Paloma / Mai Tai','$12'] ],
    note:'Flat $12 across the cocktail list — simple, and cheaper than the Whalers Village bars.',
    dist:{ kaanapali:[1.2, 6], wailea:[36, 62] } },

  // ---- South Maui ----
  { id:'monkeypod-w', name:'Monkeypod Kitchen', area:'wailea', where:'Wailea Gateway Center',
    lat:20.7085, lon:-156.4432, phone:'+18088913000', phoneLabel:'(808) 891-3000',
    days:'Daily', from:'15:30', to:'17:00', confidence:'good',
    prices:[ ['Draft beer','$2 off'], ['Wine by the glass','$3 off'], ['Craft cocktails','$4 off'],
             ['Appetizers','half off (no seafood)'], ['Wood-fired pizza','$13'] ],
    note:'Sources disagree on whether it is 3:00–5:30 or 3:30–5:00, and on a second late-night window. Call if you are timing it tightly.',
    dist:{ kaanapali:[35, 60], wailea:[2.5, 8] } },

  { id:'pintcork', name:'The Pint & Cork', area:'wailea', where:'The Shops at Wailea',
    lat:20.6893, lon:-156.4438, phone:'+18087272038', phoneLabel:'(808) 727-2038',
    days:'Daily', from:'14:00', to:'17:00', confidence:'good',
    prices:[ ['Well drinks','$7'], ['Mid-Day Margarita','$8'], ['Island Time Mule','$8'],
             ['Sliders','$5'], ['Pupus','$7–12'], ['Wine','20% off'] ],
    note:'Best price-to-quality ratio in Wailea, and a three-hour window. Walkable from the Grand Wailea via the beach path.',
    dist:{ kaanapali:[35, 60], wailea:[0.9, 5] } },

  { id:'tommybahama', name:'Tommy Bahama', area:'wailea', where:'The Shops at Wailea',
    lat:20.6890, lon:-156.4440, phone:'+18088759983', phoneLabel:'(808) 875-9983',
    days:'Daily', from:'14:00', to:'17:00', confidence:'good',
    prices:[ ['Select draft beer','$7'], ['Wines','$10–11'], ['4 signature cocktails','$12'],
             ['Martinis','$13'], ['Pupus (6 options)','$12–14'] ],
    note:'Yes, the shirt store. The bar is genuinely good and the upstairs lanai gets the sunset.',
    dist:{ kaanapali:[35, 60], wailea:[0.9, 5] } },

  { id:'gather', name:'Gather on Maui', area:'wailea', where:'Wailea Golf Club',
    lat:20.6968, lon:-156.4380, phone:'+18088799120', phoneLabel:'(808) 879-9120',
    days:'Daily', from:'15:00', to:'17:00', confidence:'good',
    prices:[ ['Draft beer','$6'], ['Classic cocktails','$8'], ['Wine by the glass','$8'],
             ['Signature cocktails','$10'], ['Appetizers','from $12'] ],
    note:'Up at the golf clubhouse, so you get the elevated view back down over the coast. Least crowded of the Wailea options.',
    dist:{ kaanapali:[35, 60], wailea:[1.5, 6] } },

  { id:'humble', name:'Humble Market Kitchin', area:'wailea', where:'Wailea Beach Resort (Marriott)',
    lat:20.6905, lon:-156.4425, phone:'+18088794655', phoneLabel:'(808) 879-4655',
    days:'Daily', from:'17:00', to:'18:00', confidence:'check',
    prices:[ ['Draft beer','$8'], ['Well drinks','$10'], ['Wine by the glass','$12'],
             ['Specialty cocktails','$14'], ['Appetizer menu','$12'] ],
    note:'Roy Yamaguchi\'s room. Sources split badly here — one says 5–6 pm, another says 2–5 pm. Call before you build a plan around it.',
    dist:{ kaanapali:[36, 61], wailea:[0.6, 4] } },

  { id:'luana', name:'Luana Lounge', area:'wailea', where:'Fairmont Kea Lani',
    lat:20.6812, lon:-156.4419, phone:'+18088754100', phoneLabel:'(808) 875-4100',
    days:'Daily', from:'16:00', to:'18:00', confidence:'check',
    prices:[ ['Drinks','$8–12'], ['Poke bowls','$10'], ['Flatbreads','$12'] ],
    note:'Open-air lounge angled straight at the sunset, and the two-hour window means you can actually sit through it.',
    dist:{ kaanapali:[36, 62], wailea:[0.7, 4] } },

  { id:'ferraros', name:'Ferraro\'s Bar e Ristorante', area:'wailea', where:'Four Seasons Maui',
    lat:20.6862, lon:-156.4443, phone:'+18088748000', phoneLabel:'(808) 874-8000',
    days:'Daily', from:'14:00', to:'17:00', confidence:'check',
    prices:[ ['Cocktails','$12'], ['Margherita pizza','$14'] ],
    note:'A $12 cocktail at the Four Seasons, oceanfront, is the best-value luxury move in Wailea. Right next door to you.',
    dist:{ kaanapali:[36, 62], wailea:[0.4, 4] } },

  { id:'threes', name:'Three\'s Bar & Grill', area:'kihei', where:'Kīhei — Kalama Village',
    lat:20.7318, lon:-156.4469, phone:'+18088793133', phoneLabel:'(808) 879-3133',
    days:'Daily', from:'14:00', to:'17:00', confidence:'good',
    prices:[ ['Draft beer','$5'], ['Well drinks','$7'], ['Craft cocktails','$8'],
             ['Pork belly bao','$5'], ['Ahi poke tacos','$6'], ['Crispy brussels','$8'] ],
    note:'Three chefs, three cuisines. Best straight food deal in South Maui and less than half Wailea pricing.',
    dist:{ kaanapali:[33, 57], wailea:[4, 11] } },

  { id:'nalus', name:'Nalu\'s South Shore Grill', area:'kihei', where:'Kīhei — Azeka Shopping Center',
    lat:20.7440, lon:-156.4497, phone:'+18088918650', phoneLabel:'(808) 891-8650',
    days:'Daily', from:'14:00', to:'17:00', confidence:'good',
    prices:[ ['Mai tai','$6'], ['Fish tacos','$5'], ['Ahi nachos','$9'] ],
    note:'A $6 mai tai and a $5 fish taco. This is the price floor for the whole island.',
    dist:{ kaanapali:[33, 56], wailea:[5, 12] } },

  { id:'fredsmex', name:'Fred\'s Mexican Beach House', area:'kihei', where:'Kīhei — Kalama Village',
    lat:20.7315, lon:-156.4463, phone:'+18088918600', phoneLabel:'(808) 891-8600',
    days:'Daily', from:'15:00', to:'17:30', confidence:'check',
    prices:[ ['Margaritas','$7'], ['Street tacos','$5'], ['Guacamole','$8'] ],
    note:'Upstairs deck with an ocean view across the road. Loud, cheap, fine.',
    dist:{ kaanapali:[33, 57], wailea:[4, 11] } },

  { id:'ko', name:'Kō', area:'wailea', where:'Fairmont Kea Lani',
    lat:20.6812, lon:-156.4419, phone:'+18088752210', phoneLabel:'(808) 875-2210',
    days:'Daily', from:'16:00', to:'17:00', confidence:'good',
    prices:[ ['Edamame','$6'], ['Tsunami fries','$8'], ['Mauka harvest salad','$13'],
             ['Hawaiian ahi poke','$14'], ['Lavender honey crispy shrimp','$15'], ['Oishi sushi','$17'] ],
    note:'The one happy hour on the island with a real published price list rather than "X off". Maui Brewing on tap, and Moet by the glass. One hour only.',
    dist:{ kaanapali:[36, 62], wailea:[0.7, 4] } },

  { id:'sansei', name:'Sansei Seafood & Sushi', area:'kaanapali', where:'Kapalua — 600 Office Rd',
    lat:20.9985, lon:-156.6520, phone:'+18086696286', phoneLabel:'(808) 669-6286',
    days:'Sun & Mon only', from:'17:00', to:'17:45', confidence:'check',
    prices:[ ['Early Bird menu','discount not published — ask'] ],
    note:'A 45-minute window, two nights a week, dine-in only. The Kīhei location has closed, so Kapalua is the only one left. Worth a call before driving up.',
    dist:{ kaanapali:[9, 20], wailea:[44, 75] } },

  { id:'coolcat', name:'Cool Cat Cafe', area:'kihei', where:'Kīhei — 1819 S Kihei Rd',
    lat:20.7255, lon:-156.4455, phone:'+18086670908', phoneLabel:'(808) 667-0908',
    days:'Daily', from:'14:00', to:'17:00', confidence:'good',
    prices:[ ['Cocktails (mai tai, margarita, espresso martini)','$8'], ['Well drinks','$5'],
             ['Shots','$5'], ['Draft beer','$1 off'], ['Pulled pork street taco','$5'],
             ['Pulled pork plate lunch','$10'], ['Sliders, mix & match','$10–12'],
             ['Loaded Philly cheesesteak fries','$14'] ],
    note:'Relocated from Lahaina after the fire. Longest itemised happy hour menu in South Maui and a three-hour window.',
    dist:{ kaanapali:[33, 57], wailea:[3.5, 10] } },

  { id:'fivepalms', name:'5 Palms Restaurant', area:'kihei', where:'Mana Kai Maui, on Keawakapu Beach',
    lat:20.7040, lon:-156.4472, phone:'+18088792607', phoneLabel:'(808) 879-2607',
    days:'Daily', from:'14:30', to:'16:30', confidence:'check',
    prices:[ ['Maui Brewing drafts','$5'], ['Well drinks','$7'], ['Pupus','$9'] ],
    note:'Directly on the sand at Keawakapu — arguably a better beach setting than anything in Wailea, at Kīhei prices.',
    dist:{ kaanapali:[34, 59], wailea:[2.2, 8] } },
];

/* --------------------------------------------------------------------------
   The sunset sail gets its own record — it is the one timed, off-property,
   pickup-dependent thing on the trip.
   -------------------------------------------------------------------------- */
export const SAIL = {
  operator: 'Kai Kanani',
  trip: 'Adventure Sunset Sail',
  date: '2026-09-02',
  window: '3:45 pm – 6:30 pm',
  guests: '2 adults',
  phone: '+18088797218',
  phoneLabel: '(808) 879-7218',
  site: 'https://www.kaikanani.com/',
  // waiver link lives in the vault — it is a capability URL, see README
  store: { name:'Kai Kanani Store', address:'108 Wailea Ike Dr, Suite 1203, Wailea, HI 96753', lat:20.7053, lon:-156.4405 },
  beach: { name:'Maluaka Beach', note:'Vans shuttle everyone from the store down to Maluaka for beach loading.', lat:20.6519, lon:-156.4460 },
  conflict: {
    a: { label:'Resort pickup', time:'4:00 pm', text:'"We\'ll pick you up at 4:00 pm from Grand Wailea Resort & Spa. Please meet us at the Side Group Entrance. Allow a 15-minute window for your driver."' },
    b: { label:'Store check-in', time:'4:30 pm', text:'"Check-in Time: 4:30 PM; Location: Kai Kanani Store, 108 Wailea Ike Dr. We\'ll depart promptly at 4:45 PM."' },
  },
  bring: ['Valid ID', 'A bag for personal items', 'Cash for gratuities and merch', 'Clothes you don\'t mind getting wet — you load from the beach'],
  cancel: 'Full refund if cancelled 48+ hours ahead for a party of 1–4. No-shows are charged in full.',
};

/* Practical notes. */
export const NOTES = [
  { icon:'clock', title:'Maui is 3 hours behind Phoenix',
    body:'Hawaii is UTC−10 year-round and never observes DST; Arizona is UTC−7 year-round. The gap is 3 hours all year. Your body will want breakfast at 4 am for the first two days — use it, mornings are the best part of the day here.' },
  { icon:'sun', title:'Sunset is around 6:45',
    body:'Roughly 6:47 on Aug 28 sliding to 6:38 by Sep 5. Dusk is short at this latitude — full dark comes about 25 minutes after the sun goes down, so don\'t plan on a long twilight walk out.' },
  { icon:'car', title:'Gas up before you need to',
    body:'Cheapest fuel is in Kahului and Kīhei. Kāʻanapali and Wailea both charge a resort premium, and there is no gas at all between Pāʻia and Hāna.' },
  { icon:'wifi', title:'Download maps before Hāna or Haleakalā',
    body:'Cell coverage dies past Pāʻia and above about 7,000 ft on the volcano. Pull an offline map area for East Maui while you still have hotel wifi.' },
  { icon:'shield', title:'Reef-safe sunscreen is the law',
    body:'Hawaii banned oxybenzone and octinoxate. Buy zinc-based on-island rather than hauling something that gets taken off you.' },
  { icon:'wave', title:'Read the shore break',
    body:'Makena Big Beach and Hoʻokipa both break hard directly onto sand and injure people every year. If nobody is in the water, that is information.' },
  { icon:'card', title:'Two credits, two hotels, two rules',
    body:'The Hyatt gives you $350 in resort credit that expires at checkout — spend it. The Grand Wailea gives you a $240 Costco Shop Card that arrives by email ~10 days after the trip starts, so it is for later, not for the trip.' },
  { icon:'turtle', title:'Ten feet from turtles, fifty from monk seals',
    body:'Honu and ʻīlio-holo-i-ka-uaua are both federally protected. Distance rules are enforced on Maui beaches, and the fines are not small.' },
];

/* --------------------------------------------------------------------------
   Restaurants. `hh` links to a HAPPY id when that venue also has a happy hour.
   `book` — how far ahead you realistically need to reserve.
   -------------------------------------------------------------------------- */
export const EATS = [
  // ---- West Maui ----
  { id:'leodas', name:'Leoda\'s Kitchen and Pie Shop', area:'West Maui', where:'820 Olowalu Village Rd, Olowalu',
    lat:20.8090, lon:-156.6180, phone:'+18086623600', phoneLabel:'(808) 662-3600',
    price:'$$', cuisine:'Sandwiches, pot pies, pie', book:'walk-in', hours:'10 am – 6 pm daily',
    blurb:'Roadside pie shop at mile marker 15, run by the Old Lāhainā Lūʻau group. Savoury pot pies and sandwiches, but the whole point is the pie counter.',
    tip:'Buy a whole banana cream or chocolate macadamia nut pie, not a slice. It sits directly on the road between your two hotels — the correct move-day lunch on Sep 1, paired with the Olowalu turtle reef 500 yards away.',
    dist:{ kaanapali:[12, 20], wailea:[22, 35] }, star:true },

  { id:'starnoodle', name:'Star Noodle', area:'West Maui', where:'Front Street, Lahaina',
    lat:20.8862, lon:-156.6820, phone:'+18086675400', phoneLabel:'(808) 667-5400',
    price:'$$', cuisine:'Asian fusion, noodles', book:'a few days', hours:'Dinner',
    blurb:'Maui institution. It lost its Lahaina home in the fire and has reopened oceanfront on Front Street next to the Old Lāhainā Lūʻau — a considerably better room than the industrial-park original.',
    tip:'Garlic noodles and the pork belly bao are why people have gone for fifteen years. Eating here also puts money directly into Lahaina\'s recovery.',
    dist:{ kaanapali:[4.5, 12], wailea:[32, 55] }, star:true },

  { id:'plantationhouse', name:'The Plantation House', area:'West Maui', where:'Plantation Golf Course clubhouse, Kapalua',
    lat:20.9995, lon:-156.6420, phone:'+18086696299', phoneLabel:'(808) 669-6299',
    price:'$$$', cuisine:'Hawaiian regional', book:'worth booking', hours:'Breakfast, lunch, dinner',
    blurb:'Up in the clubhouse above the 18th green, looking down the coast toward Molokaʻi. Widely called the best view of any restaurant on Maui.',
    tip:'Breakfast is the sleeper here — same view, a third of the dinner bill. They do run a happy hour, but current times and prices are not published anywhere I could verify. Call.',
    dist:{ kaanapali:[9, 21], wailea:[45, 77] }, star:true },

  { id:'sansei-eat', name:'Sansei Seafood & Sushi', area:'West Maui', where:'600 Office Rd, Kapalua',
    lat:20.9985, lon:-156.6520, phone:'+18086696286', phoneLabel:'(808) 669-6286',
    price:'$$$', cuisine:'Sushi, Pacific Rim', book:'a few days', hours:'Dinner',
    blurb:'Long-running sushi room with a Pacific Rim slant. The Kīhei branch has closed, so Kapalua is the last one on Maui.',
    tip:'The Sunday and Monday early bird runs 5:00–5:45 pm, dine-in only — a 45-minute window you have to genuinely plan around.',
    dist:{ kaanapali:[9, 20], wailea:[44, 75] }, hh:'sansei' },

  { id:'dukes-eat', name:'Duke\'s Beach House', area:'West Maui', where:'Honua Kai, 130 Kai Malina Pkwy',
    lat:20.9432, lon:-156.6870, phone:'+18086622900', phoneLabel:'(808) 662-2900',
    price:'$$$', cuisine:'Hawaiian, seafood', book:'Booked — Aug 29, 6:30 pm', hours:'Bar from 7:30 am',
    blurb:'Beachfront, named for Duke Kahanamoku, with a downstairs Barefoot Bar that takes no reservations at all.',
    tip:'No happy hour — they discontinued it, so do not plan a cheap warm-up here. The Barefoot Bar is still walk-in and has live music from noon. Your table is held 1h 30m for two, with a 5-minute grace period.',
    dist:{ kaanapali:[2.5, 8], wailea:[34, 58] }, booked:true },

  { id:'hulagrill-eat', name:'Hula Grill', area:'West Maui', where:'Whalers Village, on the sand',
    lat:20.9231, lon:-156.6948, phone:'+18086676636', phoneLabel:'(808) 667-6636',
    price:'$$$', cuisine:'Hawaiian, seafood', book:'walk-in downstairs', hours:'11 am – 9 pm',
    blurb:'Two restaurants in one — a proper dining room upstairs, and the Barefoot Bar downstairs with tables literally in the sand.',
    tip:'Skip upstairs. The Barefoot Bar has the same view, cheaper food, live music, and no reservation. Be there by 5:30 for a sunset table.',
    dist:{ kaanapali:[0.3, 6], wailea:[36, 62] }, hh:'hulagrill' },

  { id:'leilanis-eat', name:'Leilani\'s on the Beach', area:'West Maui', where:'Whalers Village',
    lat:20.9229, lon:-156.6946, phone:'+18086614495', phoneLabel:'(808) 661-4495',
    price:'$$$', cuisine:'Steak, seafood', book:'walk-in downstairs', hours:'11 am – 9 pm',
    blurb:'Same split as Hula Grill next door — the Beachside Grill downstairs is casual and open-air, upstairs is the dinner version.',
    tip:'The Hula Pie is shared across this restaurant group and is roughly the size of a hubcap. One between two people, minimum.',
    dist:{ kaanapali:[0.3, 6], wailea:[36, 62] }, hh:'leilanis' },

  { id:'monkeypod-k-eat', name:'Monkeypod Kitchen', area:'West Maui', where:'Whalers Village',
    lat:20.9232, lon:-156.6939, phone:'+18086626000', phoneLabel:'(808) 662-6000',
    price:'$$', cuisine:'Farm-to-table, pizza', book:'walk-in or same-day', hours:'11 am – 10 pm',
    blurb:'Peter Merriman\'s casual room. Wood-fired pizza, local fish, 36 taps, and the mai tai everyone photographs.',
    tip:'The honey–lilikoʻi foam on the mai tai is not a gimmick — it genuinely changes the drink. Happy hour takes $4 off it.',
    dist:{ kaanapali:[0.3, 6], wailea:[36, 62] }, hh:'monkeypod-k' },

  { id:'mauibrewing-eat', name:'Maui Brewing Co.', area:'West Maui', where:'Kāʻanapali',
    lat:20.9247, lon:-156.6906, phone:'+18086694700', phoneLabel:'(808) 669-4700',
    price:'$$', cuisine:'Brewpub', book:'walk-in', hours:'11 am – 10 pm',
    blurb:'The island\'s brewery, with beer actually made on Maui rather than shipped in. Pizza, burgers, pub food done properly.',
    tip:'Bikini Blonde and Coconut Porter are the two to try. The Coconut Porter is genuinely unusual and not sweet.',
    dist:{ kaanapali:[0.5, 7], wailea:[35, 60] }, hh:'mauibrewing' },

  // ---- North Shore ----
  { id:'mamas', name:'Mama\'s Fish House', area:'North Shore', where:'799 Poho Pl, Pāʻia',
    lat:20.9186, lon:-156.3616, phone:'+18085798488', phoneLabel:'(808) 579-8488',
    price:'$$$$', cuisine:'Seafood', book:'Months ahead', hours:'Lunch & dinner',
    blurb:'The most famous restaurant in Hawaii, on its own cove north of Pāʻia. The menu names the fisherman who landed each fish that morning.',
    tip:'Two hard facts: it books months out, and it is the most expensive meal on the island by a distance. If you want it, check tonight for a cancellation — they do surface. Since July 2026 they ask hats come off in the dining room and bars from 5 pm.',
    dist:{ kaanapali:[35, 62], wailea:[26, 42] }, star:true, splurge:true },

  { id:'paiafish', name:'Paia Fish Market', area:'North Shore', where:'100 Hana Hwy, Pāʻia',
    lat:20.9037, lon:-156.3703, phone:'+18085798030', phoneLabel:'(808) 579-8030',
    price:'$', cuisine:'Fish plates, tacos', book:'walk-in only', hours:'11 am – 9:30 pm',
    blurb:'Order at the counter, sit at a shared picnic table. Fresh fish, huge portions, no ceremony.',
    tip:'This is the answer to "Mama\'s is booked." Plates run roughly $18–25 for fish as fresh, two minutes down the road. Go before or after the Hāna highway.',
    dist:{ kaanapali:[34, 60], wailea:[25, 40] }, star:true },

  // ---- South Maui ----
  { id:'ko-eat', name:'Kō', area:'South Maui', where:'Fairmont Kea Lani, 4100 Wailea Alanui',
    lat:20.6812, lon:-156.4419, phone:'+18088752210', phoneLabel:'(808) 875-2210',
    price:'$$$$', cuisine:'Hawaiian regional', book:'a week+', hours:'Dinner 5–9 pm',
    blurb:'Built around Maui\'s sugarcane plantation history — the menu reads Hawaiian, Japanese, Chinese, Filipino, Portuguese, which is exactly who worked the plantations.',
    tip:'Four minutes from your room. The 4–5 pm happy hour is the cheapest way into this kitchen — $6 edamame and $14 poke at a Fairmont.',
    dist:{ kaanapali:[36, 62], wailea:[0.7, 4] }, hh:'ko', star:true },

  { id:'duo', name:'DUO Steak & Seafood', area:'South Maui', where:'Four Seasons, 3900 Wailea Alanui',
    lat:20.6862, lon:-156.4443, phone:'+18088748000', phoneLabel:'(808) 874-8000',
    price:'$$$$', cuisine:'Steakhouse, seafood', book:'a week+', hours:'Breakfast & dinner',
    blurb:'The Four Seasons steakhouse — open-air, dry-aged ribeye and filet alongside local fish. The name is the two halves of the menu.',
    tip:'Breakfast at DUO is the underrated one. And Ferraro\'s, same resort, does $12 cocktails at happy hour if you want the address without the steakhouse bill.',
    dist:{ kaanapali:[36, 62], wailea:[0.4, 4] }, splurge:true },

  { id:'matteos', name:'Matteo\'s Osteria', area:'South Maui', where:'161 Wailea Ike Pl',
    lat:20.7040, lon:-156.4400, phone:'+18088918466', phoneLabel:'(808) 891-8466',
    price:'$$$', cuisine:'Italian', book:'a few days', hours:'Dinner from ~4:45 pm',
    blurb:'Serious Italian in a Wailea strip centre, with a wine list well beyond what the location suggests.',
    tip:'The last published note says they dropped happy hour when they moved to a 4:45 pm open, though listings still mention a bar-lounge window. Ask when you call.',
    dist:{ kaanapali:[35, 60], wailea:[1.3, 6] } },

  { id:'monkeypod-w-eat', name:'Monkeypod Kitchen', area:'South Maui', where:'Wailea Gateway Center',
    lat:20.7085, lon:-156.4432, phone:'+18088913000', phoneLabel:'(808) 891-3000',
    price:'$$', cuisine:'Farm-to-table, pizza', book:'walk-in or same-day', hours:'11 am – 10 pm',
    blurb:'The South Maui twin of the Kāʻanapali room. Same menu, same mai tai, eight minutes from the Grand Wailea.',
    tip:'The reliable default when you want something good and unfussy without a reservation or a resort bill.',
    dist:{ kaanapali:[35, 60], wailea:[2.5, 8] }, hh:'monkeypod-w' },

  { id:'threes-eat', name:'Three\'s Bar & Grill', area:'South Maui', where:'Kīhei — Kalama Village',
    lat:20.7318, lon:-156.4469, phone:'+18088793133', phoneLabel:'(808) 879-3133',
    price:'$$', cuisine:'Hawaiian, Southwest, Asian', book:'walk-in', hours:'8 am – 9 pm',
    blurb:'Three chefs with three different backgrounds who refused to pick one cuisine, so the menu runs all three at once.',
    tip:'Best-value sit-down meal in South Maui, and the 2–5 pm happy hour is the cheapest good food on this side of the island.',
    dist:{ kaanapali:[33, 57], wailea:[4, 11] }, hh:'threes' },
];

/* --------------------------------------------------------------------------
   Pre-departure tasks. `by` is the date it should be done by.
   -------------------------------------------------------------------------- */
export const PRETRIP = [
  { id:'checkin',  by:'2026-08-27', title:'Check in for AA 645',
    detail:'Opens 24 hours out — Thursday Aug 27, 10:52 am Phoenix time.' },
  { id:'waiver',   by:'2026-08-31', title:'Sign the Kai Kanani sailing waiver',
    detail:'Both of you. The confirmation flags it as the next step — do it now, not on the beach.',
    vaultLink:'waiver' },
  { id:'sailcall', by:'2026-08-31', title:'Call Kai Kanani about the 4:00 vs 4:30 pickup',
    detail:'Your confirmation gives two different instructions. One call settles it.',
    tel:'+18088797218' },
  { id:'maps',     by:'2026-08-28', title:'Download an offline map of East Maui',
    detail:'No signal past Pāʻia or above 7,000 ft. Do this on home wifi, not at the airport.' },
  { id:'sunscreen',by:'2026-08-28', title:'Leave the non-reef-safe sunscreen at home',
    detail:'Oxybenzone and octinoxate are banned in Hawaii. Buy zinc-based on-island.' },
  { id:'mamas',    by:'2026-08-28', title:'Check Mama\'s Fish House for a cancellation',
    detail:'Books months out, but cancellations surface. Worth one look before you go.',
    tel:'+18085798488' },
  { id:'iao',      by:'2026-08-30', title:'Reserve ʻĪao Valley parking if you want to go',
    detail:'Non-residents must book online in advance. It is not a walk-up.' },
  { id:'haleakala',by:'2026-09-01', title:'Decide on Haleakalā — sunrise needs a reservation',
    detail:'Sunrise entry is booked on recreation.gov, 60 days out plus a 48-hour release batch. Sunset needs nothing.' },
];

/* --------------------------------------------------------------------------
   Packing list. Checked state lives in localStorage, per device.
   -------------------------------------------------------------------------- */
export const PACKING = [
  { group:'Do not forget', items:[
    'Reef-safe (zinc) sunscreen',
    'Sunglasses, plus a spare pair',
    'Hat with a brim',
    'Reef shoes — Honolua and Olowalu are rocky entries',
    'Snorkel mask, if you own one you like',
    'Dry bag for the sunset sail',
    'Real jackets if Haleakalā happens — 35–45°F at the summit',
  ]},
  { group:'Beach days', items:[
    'Swimsuits ×3 — nothing dries fast here',
    'Rash guard, better sun protection than reapplying',
    'Beach towels — check what the resorts provide first',
    'Waterproof phone pouch',
    'Aloe or after-sun',
  ]},
  { group:'Evenings', items:[
    'One collared shirt — Kō, DUO, Plantation House',
    'One nice dress',
    'Sandals you can walk a mile in',
    'A light layer — it drops into the 60s upcountry',
  ]},
  { group:'Practical', items:[
    'Chargers and a battery pack for long drive days',
    'Car phone mount for the Hāna highway',
    'Motion sickness tablets — the sail and the Hāna road both earn them',
    'Refillable water bottles',
    'Small bills for gratuities and roadside fruit stands',
    'Prescriptions — pharmacies are in Kahului and Kīhei only',
  ]},
];
