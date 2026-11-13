// Список уроков. Его меняет админка (admin.html) — вручную можно, но формат должен остаться JSON.
// id — имя файлов в v/: <id>.mp4 (видео), <id>.jpg (обложка), <id>-p3.mp4 (анимация обложки, если pv: true)
// sec — раздел; name — название; dur — длительность, сек; ru — русские слова для поиска;
// added — дата добавления ГГГГ-ММ-ДД (значок NEW); hidden — скрыт из приложения; chapters — главы [{t: сек, title}]
// desc — описание урока по языкам {ru, en, es, pt, fr, de, ja, ko, zh}; в приложении: свой язык, иначе английский; нет — блока нет
window.LESSONS_DATA = [
 {
  "id": "tr-indian-step",
  "sec": "Toprock",
  "name": "Indian step",
  "dur": 40,
  "ru": "Indian step Индиан степ",
  "added": "2026-11-04",
  "pv": true,
  "vertical": true,
  "r2": "tr-indian-step-5i96sa6m.mp4"
 },
 {
  "id": "tr-cross",
  "sec": "Toprock",
  "name": "Cross step",
  "dur": 52,
  "ru": "кросс степ",
  "pv": true,
  "vertical": true,
  "r2": "tr-cross-5if3qtlc.mp4"
 },
 {
  "id": "tr-kick-step",
  "sec": "Toprock",
  "name": "Kick step",
  "dur": 70,
  "ru": "кикстеп kick step",
  "added": "2026-11-02",
  "pv": true,
  "vertical": true,
  "r2": "tr-kick-step-5iix8jqf.mp4"
 },
 {
  "id": "fw-6step",
  "sec": "Footwork",
  "name": "6-step",
  "dur": 28,
  "ru": "сикс степ шесть шагов",
  "pv": true,
  "vertical": true,
  "r2": "fw-6step-5iu2h0ii.mp4"
 },
 {
  "id": "fw-3step",
  "sec": "Footwork",
  "name": "3-step",
  "dur": 33,
  "ru": "три степ",
  "pv": true,
  "vertical": true,
  "r2": "fw-3step-5j8vxy9g.mp4"
 },
 {
  "id": "fw-baby-love",
  "sec": "Footwork",
  "name": "Baby love",
  "dur": 46,
  "ru": "Baby love",
  "added": "2026-11-07",
  "pv": true,
  "vertical": true,
  "ks": "9365fefb-f0d4-49a7-8a55-34dd56a9a68e"
 },
 {
  "id": "fw-cc",
  "sec": "Footwork",
  "name": "CC",
  "dur": 26,
  "ru": "сиси сс",
  "pv": true,
  "vertical": true,
  "r2": "fw-cc-5jcxjs45.mp4"
 },
 {
  "id": "fw-zulu",
  "sec": "Footwork",
  "name": "Zulu spin",
  "dur": 23,
  "ru": "зулу спин",
  "pv": true,
  "vertical": true,
  "r2": "fw-zulu-5jgingql.mp4"
 },
 {
  "id": "fw-hooks",
  "sec": "Footwork",
  "name": "Hooks",
  "dur": 26,
  "ru": "хуки хук",
  "added": "2026-10-26",
  "pv": true,
  "vertical": true,
  "r2": "fw-hooks-5jjfvtog.mp4"
 },
 {
  "id": "fw-kickout",
  "sec": "Footwork",
  "name": "Kick-out steps",
  "dur": 35,
  "ru": "кик аут",
  "pv": true,
  "vertical": true,
  "r2": "fw-kickout-5jn0e4er.mp4"
 },
 {
  "id": "fw-fishtail",
  "sec": "Footwork",
  "name": "Fishtail flip",
  "dur": 34,
  "ru": "фиштейл флип",
  "added": "2026-10-26",
  "pv": true,
  "vertical": true,
  "r2": "fw-fishtail-5jt17l7a.mp4"
 },
 {
  "id": "gd-underknee",
  "sec": "Godowns",
  "name": "Underknee",
  "dur": 13,
  "ru": "андерни под колено",
  "pv": true,
  "vertical": true,
  "r2": "gd-underknee-5jwzo0bt.mp4"
 },
 {
  "id": "gd-unknown",
  "sec": "Godowns",
  "name": "[Godown без названия]",
  "dur": 32,
  "ru": "",
  "pv": true,
  "vertical": true,
  "r2": "gd-unknown-5jzr6kuk.mp4"
 },
 {
  "id": "gd-windmill-entry",
  "sec": "Godowns",
  "name": "windmill entry",
  "dur": 488,
  "ru": "заход в гелик windmill entry",
  "added": "2026-10-30",
  "pv": true,
  "ks": "23993e1d-9e0f-4e07-9ac9-de62a0cfabad",
  "desc": {
   "ru": "Как зайти в гелик с ног. Сначала сход из спичака и со стойки на руках в бэкспин, потом заход с ног: куда ставить руки, как работает левый локоть и почему нельзя валиться в поясницу.",
   "en": "How to enter a windmill from your feet. First, drops from a press handstand and a handstand into a backspin, then the full entry: where to put your hands, what the left elbow does, and why you must not fall onto your lower back.",
   "es": "Cómo entrar al windmill desde los pies. Primero, bajadas desde el press handstand y el pino a backspin; luego la entrada completa: dónde poner las manos, qué hace el codo izquierdo y por qué no hay que caer sobre la zona lumbar.",
   "pt": "Como entrar no windmill a partir dos pés. Primeiro, descidas do press handstand e da parada de mão para o backspin; depois a entrada completa: onde colocar as mãos, o que faz o cotovelo esquerdo e por que não se deve cair na lombar.",
   "fr": "Entrer dans le windmill depuis les pieds. D’abord les descentes du press handstand et de l’équilibre vers le backspin, puis l’entrée complète : où poser les mains, le rôle du coude gauche et pourquoi il ne faut pas tomber sur les lombaires.",
   "de": "So kommst du aus dem Stand in die Windmill. Zuerst aus dem Press-Handstand und dem Handstand in den Backspin, dann der komplette Einstieg: wohin die Hände kommen, was der linke Ellbogen macht und warum du nicht auf den unteren Rücken fallen darfst.",
   "ja": "立った状態からウィンドミルに入る方法。まずプレスハンドスタンドと倒立からバックスピンへ降りる練習、次に本番の入り方：手の位置、左ひじの使い方、そして腰から落ちてはいけない理由。",
   "ko": "서 있는 자세에서 윈드밀로 들어가는 법. 먼저 프레스 핸드스탠드와 물구나무에서 백스핀으로 내려오는 연습, 그다음 실제 진입: 손 위치, 왼쪽 팔꿈치의 역할, 그리고 허리로 떨어지면 안 되는 이유.",
   "zh": "如何从站立直接进入 windmill。先练从 press handstand 和倒立落到 backspin，再练完整的进入：手放哪里、左肘怎么用，以及为什么不能砸到腰上。"
  }
 },
 {
  "id": "gd-knee-down-spin",
  "sec": "Godowns",
  "name": "Knee down spin",
  "dur": 29,
  "ru": "",
  "added": "2026-11-08",
  "pv": true,
  "vertical": true,
  "ks": "32636f48-5008-4c13-8c63-cc76fc4a5376"
 },
 {
  "id": "fr-easychair",
  "sec": "Freezes",
  "name": "Easy chair freeze",
  "dur": 21,
  "ru": "изи чеир стул chair чер",
  "pv": true,
  "vertical": true,
  "r2": "fr-easychair-5k378e3e.mp4"
 },
 {
  "id": "fr-elbow",
  "sec": "Freezes",
  "name": "Elbow freeze",
  "dur": 39,
  "ru": "элбоу локоть",
  "added": "2026-10-26",
  "pv": true,
  "vertical": true,
  "r2": "fr-elbow-5kd77lsq.mp4"
 },
 {
  "id": "fr-shoulder-freeze",
  "sec": "Freezes",
  "name": "shoulder freeze",
  "dur": 59,
  "ru": "shoulder на плече",
  "added": "2026-10-31",
  "pv": true,
  "vertical": true,
  "r2": "fr-shoulder-freeze-5kuht6i2.mp4"
 },
 {
  "id": "tr-airchair",
  "sec": "Freezes",
  "name": "AIRCHAIR",
  "dur": 522,
  "ru": "airchair чер чейр",
  "added": "2026-11-11",
  "pv": true,
  "r2": "tr-airchair-ke4ejzel.mp4",
  "desc": {
   "ru": "Чер по стадиям: растяжка руки, первые стойки у трубы или скамейки, выжимание вверх, контроль у зеркала, отрыв локтя и складка. Чер — опасный фриз: обязательно разогревайтесь.",
   "en": "Air chair step by step: stretching the arm, first holds at a pipe or bench, pressing up, checking yourself in a mirror, lifting the elbow and the pike. The air chair is a risky freeze — always warm up.",
   "es": "Air chair paso a paso: estirar el brazo, primeras posiciones apoyándote en un tubo o un banco, empujar hacia arriba, controlarte en el espejo, despegar el codo y el pike. Es un freeze peligroso: calienta siempre.",
   "pt": "Air chair passo a passo: alongar o braço, primeiras posições apoiado num cano ou banco, empurrar para cima, conferir no espelho, tirar o cotovelo e o pike. É um freeze arriscado: aqueça sempre.",
   "fr": "L’air chair étape par étape : étirer le bras, premiers maintiens à un tuyau ou un banc, pousser vers le haut, se contrôler au miroir, décoller le coude et le pike. C’est un freeze risqué : échauffe-toi toujours.",
   "de": "Air Chair Schritt für Schritt: den Arm dehnen, erste Versuche an einem Rohr oder einer Bank, nach oben drücken, Kontrolle im Spiegel, den Ellbogen lösen und der Pike. Der Air Chair ist ein riskanter Freeze – wärm dich immer auf.",
   "ja": "エアチェアを段階的に：腕のストレッチ、パイプやベンチを使った最初のキープ、押し上げ、鏡でのチェック、ひじを離す、そしてパイク。エアチェアは危険なフリーズなので、必ずウォームアップを。",
   "ko": "단계별 에어체어: 팔 스트레칭, 파이프나 벤치를 잡고 하는 첫 버티기, 밀어 올리기, 거울로 확인하기, 팔꿈치 떼기, 그리고 파이크. 에어체어는 위험한 프리즈이니 반드시 몸을 풀고 하세요.",
   "zh": "分阶段练 air chair：拉伸手臂、借助管子或长凳做最初的保持、向上推起、对着镜子检查、肘部离开身体，以及 pike。air chair 是有风险的定格，一定要先热身。"
  }
 },
 {
  "id": "tk-monkey",
  "sec": "Tricks",
  "name": "Monkey flip",
  "dur": 34,
  "ru": "манки флип обезьяна",
  "added": "2026-10-26",
  "pv": true,
  "vertical": true,
  "r2": "tk-monkey-5l5vx1ua.mp4"
 },
 {
  "id": "tk-turtlehs",
  "sec": "Tricks",
  "name": "Turtle → handstand freeze",
  "dur": 41,
  "ru": "черепаха стойка на руках хендстенд",
  "pv": true,
  "vertical": true,
  "r2": "tk-turtlehs-5lh3mwr0.mp4"
 },
 {
  "id": "pw-airflare",
  "sec": "Powermove",
  "name": "Airflare(airtwist)",
  "dur": 450,
  "ru": "эйрфлаер эирфлаер аирфлаер флаер твист",
  "added": "2026-10-29",
  "pv": true,
  "ks": "de8dad97-f470-4552-93c4-45575e6d3f29",
  "desc": {
   "ru": "Первый твист — для тех, кто его ещё не прыгал. Заход, фриз-складка, правый баланс и прыжки на толчковой руке, перелёт с руки на руку, затем мах левой ногой и как удержать ноги на перелёте.",
   "en": "Your first airflare — for those who have never done one. The entry, the pike freeze, right-hand balance and hops on your pushing hand, jumping from hand to hand, then the left-leg swing and keeping your legs in during the flight.",
   "es": "Tu primer airflare, para quien nunca lo ha hecho. La entrada, el freeze en pike, el equilibrio en la mano derecha y saltitos en la mano de impulso, el salto de mano a mano y, después, el swing de la pierna izquierda y cómo mantener las piernas cerca en el vuelo.",
   "pt": "Seu primeiro airflare, para quem nunca fez. A entrada, o freeze em pike, o equilíbrio na mão direita e saltinhos na mão de impulso, o salto de mão em mão e, depois, o balanço da perna esquerda e como manter as pernas junto ao corpo no voo.",
   "fr": "Ton premier airflare, pour ceux qui ne l’ont jamais fait. L’entrée, le freeze en pike, l’équilibre sur la main droite et les petits sauts sur la main d’impulsion, le saut d’une main à l’autre, puis le swing de la jambe gauche et comment garder les jambes groupées pendant le vol.",
   "de": "Dein erster Airflare – für alle, die noch nie einen gesprungen sind. Einstieg, Pike-Freeze, Balance auf der rechten Hand und Sprünge auf der Abdruckhand, der Wechsel von Hand zu Hand, dann der Schwung mit dem linken Bein und wie du die Beine im Flug bei dir hältst.",
   "ja": "はじめてのエアフレア（まだ跳んだことがない人向け）。入り、パイクのフリーズ、右手バランスと押す手でのジャンプ、手から手への跳び移り、そして左脚の振りと、跳んでいる間に脚を引きつけておくコツ。",
   "ko": "첫 에어플레어 — 아직 한 번도 못 해 본 사람을 위해. 진입, 파이크 프리즈, 오른손 밸런스와 미는 손으로 뛰기, 손에서 손으로 넘어가기, 그리고 왼다리 스윙과 비행 중 다리를 몸 쪽에 붙여 두는 법.",
   "zh": "你的第一个 airflare（给还没跳过的人）。进入、pike 定格、右手平衡和推手的小跳、从一只手跳到另一只手，然后是左腿的摆动，以及腾空时怎样把腿收住。"
  }
 },
 {
  "id": "pw-turtle",
  "sec": "Powermove",
  "name": "Turtle",
  "dur": 443,
  "ru": "тертл тартл черепаха",
  "added": "2026-10-29",
  "pv": true,
  "ks": "634db7c3-35bc-4a80-b160-c44a09cdbab8",
  "desc": {
   "ru": "Олдскул: черепаха и крабик. Куда ставить локти и ладони, как переносить вес с руки на руку и как набрать скорость на обоих элементах.",
   "en": "Old school: turtle and crab. Where to put your elbows and palms, how to shift your weight from hand to hand, and how to build speed on both moves.",
   "es": "Old school: turtle y crab. Dónde poner los codos y las palmas, cómo pasar el peso de una mano a otra y cómo ganar velocidad en los dos movimientos.",
   "pt": "Old school: turtle e crab. Onde colocar cotovelos e palmas, como passar o peso de uma mão para a outra e como ganhar velocidade nos dois movimentos.",
   "fr": "Old school : turtle et crab. Où placer les coudes et les paumes, comment passer le poids d’une main à l’autre et comment prendre de la vitesse sur les deux mouvements.",
   "de": "Old School: Turtle und Crab. Wohin Ellbogen und Handflächen kommen, wie du das Gewicht von Hand zu Hand verlagerst und wie du bei beiden Moves Tempo aufbaust.",
   "ja": "オールドスクール：タートルとクラブ。ひじと手のひらの位置、手から手への体重移動、そして両方の技でスピードを上げる方法。",
   "ko": "올드스쿨: 터틀과 크랩. 팔꿈치와 손바닥 위치, 손에서 손으로 체중을 옮기는 법, 그리고 두 동작 모두에서 속도를 올리는 법.",
   "zh": "old school：turtle 和 crab。手肘和手掌放哪里、怎样把重心从一只手移到另一只手，以及两个动作怎样提速。"
  }
 },
 {
  "id": "pw-windmill",
  "sec": "Powermove",
  "name": "Windmill",
  "dur": 365,
  "ru": "виндмил виндмилл мельница",
  "added": "2026-10-29",
  "pv": true,
  "ks": "8b3ef664-01b9-42db-a1e1-b88ad726c46c",
  "desc": {
   "ru": "Гелик для тех, кто начинает с нуля: бейби-фриз, подъём ноги, бэкспин, кувырок в бейби-фриз, их соединение — и заход, как на настоящий гелик.",
   "en": "Windmill for complete starters: baby freeze, leg raise, backspin, a roll into the baby freeze, putting them together — and the entry used for a real windmill.",
   "es": "Windmill para quien empieza de cero: baby freeze, elevar la pierna, backspin, voltereta al baby freeze, juntarlo todo… y la entrada de un windmill de verdad.",
   "pt": "Windmill para quem começa do zero: baby freeze, elevar a perna, backspin, rolamento para o baby freeze, juntar tudo… e a entrada de um windmill de verdade.",
   "fr": "Le windmill pour ceux qui partent de zéro : baby freeze, lever la jambe, backspin, roulade jusqu’au baby freeze, tout enchaîner… et l’entrée d’un vrai windmill.",
   "de": "Windmill für absolute Anfänger: Baby Freeze, Bein heben, Backspin, Rolle in den Baby Freeze, alles verbinden – und der Einstieg für eine echte Windmill.",
   "ja": "ゼロから始める人のためのウィンドミル：ベビーフリーズ、脚上げ、バックスピン、ベビーフリーズへの前転、それらをつなげる。そして本物のウィンドミルの入り方。",
   "ko": "완전 처음 시작하는 사람을 위한 윈드밀: 베이비 프리즈, 다리 들기, 백스핀, 베이비 프리즈로 구르기, 이들을 연결하기 — 그리고 진짜 윈드밀의 진입.",
   "zh": "零基础 windmill：baby freeze、抬腿、backspin、翻滚进 baby freeze，再把它们连起来——以及真正 windmill 的进入方式。"
  }
 },
 {
  "id": "pw-swipes",
  "sec": "Powermove",
  "name": "Swipes",
  "dur": 333,
  "ru": "свайпы свайп свипы",
  "added": "2026-10-29",
  "pv": true,
  "ks": "6ee9d371-0eb2-4221-8f98-35a9c985c3ba",
  "desc": {
   "ru": "Свайпс с нуля: сначала через две ноги, разворот корпуса, руки в упор, затем свайпс через одну ногу с захода боком и высокий таз на каждом обороте.",
   "en": "Swipes from scratch: first on two feet, turning your body, hands locked into the floor, then the one-leg swipe entered sideways, with your hips high on every rotation.",
   "es": "Swipes desde cero: primero con los dos pies, girando el cuerpo y con las manos firmes en el suelo; luego el swipe con una pierna entrando de lado y con la cadera alta en cada vuelta.",
   "pt": "Swipes do zero: primeiro com os dois pés, girando o corpo e com as mãos firmes no chão; depois o swipe com uma perna entrando de lado e com o quadril alto em cada volta.",
   "fr": "Les swipes depuis zéro : d’abord sur deux pieds, en tournant le buste, mains bien ancrées au sol, puis le swipe sur une jambe avec une entrée de côté et le bassin haut à chaque tour.",
   "de": "Swipes von Grund auf: zuerst auf beiden Füßen, mit Drehung des Oberkörpers und fest in den Boden gedrückten Händen, dann der Swipe über ein Bein mit seitlichem Einstieg und hoher Hüfte bei jeder Umdrehung.",
   "ja": "ゼロからのスワイプス：まず両足で、体をひねり、手でしっかり床を押す。次に横向きから入る片足スワイプス、毎回転で腰を高く。",
   "ko": "처음부터 배우는 스와이프스: 먼저 두 발로, 몸통 돌리기, 손으로 바닥을 단단히 누르기. 그다음 옆으로 진입하는 한 발 스와이프스, 매 회전마다 골반은 높게.",
   "zh": "从零开始学 swipes：先用双脚，转动身体、双手撑稳地面；然后是侧身进入的单腿 swipe，每一圈都保持高臀位。"
  }
 },
 {
  "id": "pw-headspin",
  "sec": "Powermove",
  "name": "Headspin",
  "dur": 318,
  "ru": "хедспин хэдспин вращение на голове",
  "added": "2026-10-29",
  "pv": true,
  "ks": "8a2e472e-d16f-4c45-9032-b4781ba7d840",
  "desc": {
   "ru": "Кручение на голове: на какое место головы вставать, как ставить руки, почему машет таз, а не ноги, как избавиться от плавающих ног и когда отпускать руки.",
   "en": "Headspin basics: which spot on your head to stand on, how to place your hands, why the hips swing and not the legs, how to stop your legs from drifting, and when to let go of your hands.",
   "es": "Bases del headspin: en qué punto de la cabeza apoyarse, cómo colocar las manos, por qué balancea la cadera y no las piernas, cómo evitar que las piernas se muevan y cuándo soltar las manos.",
   "pt": "Base do headspin: em que ponto da cabeça apoiar, como posicionar as mãos, por que quem balança é o quadril e não as pernas, como evitar que as pernas fiquem soltas e quando soltar as mãos.",
   "fr": "Les bases du headspin : sur quel point de la tête se poser, comment placer les mains, pourquoi c’est le bassin qui balance et pas les jambes, comment empêcher les jambes de flotter et quand lâcher les mains.",
   "de": "Headspin-Grundlagen: auf welcher Stelle des Kopfes du stehst, wie du die Hände setzt, warum die Hüfte schwingt und nicht die Beine, wie du verhinderst, dass die Beine wackeln, und wann du die Hände loslässt.",
   "ja": "ヘッドスピンの基本：頭のどこで立つか、手の置き方、脚ではなく腰で振る理由、脚がぶれないようにする方法、そして手を離すタイミング。",
   "ko": "헤드스핀 기본: 머리의 어느 지점으로 서는지, 손 위치, 다리가 아니라 골반으로 스윙하는 이유, 다리가 흔들리지 않게 하는 법, 그리고 손을 놓는 타이밍.",
   "zh": "headspin 基础：用头的哪个位置着地、手怎么放、为什么是臀部带动而不是腿在甩、怎样让腿不再晃，以及什么时候松手。"
  }
 },
 {
  "id": "pw-munchmill",
  "sec": "Powermove",
  "name": "munchmill",
  "dur": 780,
  "ru": "munchmill nuchmill мачмил бочка барел",
  "added": "2026-10-30",
  "pv": true,
  "ks": "dfb81103-2a48-4752-938a-b851625ae79f",
  "desc": {
   "ru": "Мачмил подробно: заход с приземлением на левое плечо, перекат «бочкой», сначала тело — потом ноги, толчок от бедра, работа рук и как сделать много оборотов. В конце — как не отбить рёбра и не содрать плечи.",
   "en": "Munchmill in detail: the entry landing on your left shoulder, rolling like a barrel, body first and legs second, pushing from the hip, what the arms do, and how to get more rotations. Plus how to protect your ribs and shoulders.",
   "es": "Munchmill en detalle: la entrada cayendo sobre el hombro izquierdo, rodar como un barril, primero el cuerpo y luego las piernas, el empuje desde la cadera, el trabajo de brazos y cómo sumar vueltas. Además, cómo proteger costillas y hombros.",
   "pt": "Munchmill em detalhe: a entrada caindo no ombro esquerdo, rolar como um barril, primeiro o corpo e depois as pernas, o impulso a partir do quadril, o trabalho dos braços e como fazer mais voltas. E como proteger costelas e ombros.",
   "fr": "Le munchmill en détail : l’entrée en arrivant sur l’épaule gauche, rouler comme un tonneau, le corps d’abord et les jambes ensuite, la poussée depuis la hanche, le travail des bras et comment enchaîner les tours. Et comment protéger côtes et épaules.",
   "de": "Munchmill im Detail: der Einstieg mit Landung auf der linken Schulter, Rollen wie ein Fass, erst der Körper, dann die Beine, der Stoß aus der Hüfte, die Arbeit der Arme und wie du mehr Umdrehungen schaffst. Dazu: wie du Rippen und Schultern schützt.",
   "ja": "マンチミルを詳しく：左肩に着地する入り、樽のように転がる、まず体・次に脚、股関節からの押し、腕の使い方、回転数を増やすコツ。さらに肋骨と肩を守る方法も。",
   "ko": "먼치밀 자세히: 왼쪽 어깨로 착지하는 진입, 통처럼 굴러가기, 몸 먼저 그다음 다리, 고관절에서 미는 힘, 팔의 역할, 회전 수를 늘리는 법. 그리고 갈비뼈와 어깨를 보호하는 법까지.",
   "zh": "munchmill 详解：落在左肩上的进入、像木桶一样滚、先身体后腿、从髋部发力、手臂怎么配合，以及怎样转更多圈。另外讲怎样保护肋骨和肩膀。"
  }
 },
 {
  "id": "tr-windmill-head",
  "sec": "Powermove",
  "name": "Windmill(head)",
  "dur": 570,
  "ru": "гелик windmill гелик через голову гелик с головой",
  "added": "2026-10-30",
  "pv": true,
  "ks": "8da3c6ff-6f53-41ab-9f02-755358e3e5df",
  "desc": {
   "ru": "Гелик через голову: выход с бэкспина на голову, выход с гелика на голову, затем гелик через голову с руками и без рук — куда ставить голову, как подставлять плечо и как толкаться ногами.",
   "en": "Windmill through the head: from a backspin onto your head, from a windmill onto your head, then the head windmill with and without hands — where to put your head, how to land on your shoulder and how to push with your legs.",
   "es": "Windmill por la cabeza: del backspin a la cabeza, del windmill a la cabeza y después el windmill por la cabeza con y sin manos: dónde apoyar la cabeza, cómo meter el hombro y cómo empujar con las piernas.",
   "pt": "Windmill pela cabeça: do backspin para a cabeça, do windmill para a cabeça e depois o windmill pela cabeça com e sem mãos: onde apoiar a cabeça, como encaixar o ombro e como impulsionar com as pernas.",
   "fr": "Le windmill par la tête : du backspin sur la tête, du windmill sur la tête, puis le windmill par la tête avec et sans les mains – où poser la tête, comment présenter l’épaule et comment pousser avec les jambes.",
   "de": "Windmill über den Kopf: vom Backspin auf den Kopf, von der Windmill auf den Kopf, dann die Head-Windmill mit und ohne Hände – wohin der Kopf kommt, wie du auf der Schulter landest und wie du mit den Beinen stößt.",
   "ja": "頭を通るウィンドミル：バックスピンから頭へ、ウィンドミルから頭へ、そして手あり・手なしのヘッドウィンドミル。頭をつく位置、肩の入れ方、脚での押し方。",
   "ko": "머리를 거치는 윈드밀: 백스핀에서 머리로, 윈드밀에서 머리로, 그다음 손을 쓰는/안 쓰는 헤드 윈드밀 — 머리를 어디에 두는지, 어깨를 어떻게 대는지, 다리로 어떻게 미는지.",
   "zh": "过头的 windmill：从 backspin 上到头、从 windmill 上到头，然后是用手和不用手的 head windmill——头放在哪里、怎样用肩膀接、腿怎样发力。"
  }
 },
 {
  "id": "pw-reverse-1990",
  "sec": "Powermove",
  "name": "Reverse 1990",
  "dur": 1020,
  "ru": "reverse 1990 реверс",
  "added": "2026-11-11",
  "pv": true,
  "r2": "pw-reverse-1990-jun24gi0.mp4",
  "pvAt": 2.7,
  "cv": 1,
  "desc": {
   "ru": "Реверс — 1990 на правой руке. Подводящие упражнения и баланс, безопасный первый оборот, заход «по квадрату», два варианта — в поперечном шпагате и дрил — и вариации во фризе.",
   "en": "Reverse 1990 — a 1990 on your right hand. Prep drills and balance, a safe first rotation, the “square” entry, two versions — in a side split and the drill — plus freeze variations.",
   "es": "Reverse 1990: un 1990 sobre la mano derecha. Ejercicios previos y equilibrio, una primera vuelta segura, la entrada “en cuadrado”, dos versiones (en spagat lateral y el drill) y variaciones en freeze.",
   "pt": "Reverse 1990: um 1990 na mão direita. Exercícios preparatórios e equilíbrio, uma primeira volta segura, a entrada “em quadrado”, duas versões (em espacate lateral e o drill) e variações em freeze.",
   "fr": "Reverse 1990 : un 1990 sur la main droite. Exercices préparatoires et équilibre, un premier tour sans danger, l’entrée « en carré », deux versions – en grand écart facial et le drill – et des variantes en freeze.",
   "de": "Reverse 1990 – eine 1990 auf der rechten Hand. Vorübungen und Balance, eine sichere erste Umdrehung, der „Quadrat“-Einstieg, zwei Varianten – im Seitspagat und der Drill – plus Freeze-Variationen.",
   "ja": "リバース1990（右手で回る1990）。準備ドリルとバランス、安全な最初の1回転、「四角形」の入り、2つのやり方（開脚とドリル）、そしてフリーズのバリエーション。",
   "ko": "리버스 1990 — 오른손으로 도는 1990. 준비 운동과 밸런스, 안전한 첫 회전, ‘사각형’ 진입, 두 가지 방식(옆 일자 다리와 드릴), 그리고 프리즈 변형.",
   "zh": "reverse 1990——用右手转的 1990。准备练习和平衡、安全的第一圈、“正方形”进入、两种做法（横叉和 drill），以及定格变化。"
  }
 },
 {
  "id": "tn-flare-to-airflare-to-flare",
  "sec": "Transitions",
  "name": "Flare to airflare to flare",
  "dur": 539,
  "ru": "flare to airflare флай в твист",
  "added": "2026-10-30",
  "pv": true,
  "ks": "262fa2a3-9675-40ac-8b20-5092475a3192",
  "desc": {
   "ru": "Флай — твист — флай для опытных би-боев. Выход с флая тазом вверх, прыжок со складки, маховый твист, постановка толчковой руки «как на 1990» и сход с твиста во флай.",
   "en": "Flare – airflare – flare for experienced b-boys. Getting out of the flare hips up, jumping from the pike, the swing airflare, placing the pushing hand like in a 1990, and landing from the airflare back into a flare.",
   "es": "Flare – airflare – flare para b-boys con experiencia. Salir del flare con la cadera arriba, saltar desde el pike, el airflare con swing, colocar la mano de impulso como en el 1990 y caer del airflare de vuelta al flare.",
   "pt": "Flare – airflare – flare para b-boys experientes. Sair do flare com o quadril para cima, saltar do pike, o airflare com balanço, posicionar a mão de impulso como no 1990 e cair do airflare de volta no flare.",
   "fr": "Flare – airflare – flare pour b-boys confirmés. Sortir du flare bassin en haut, sauter depuis le pike, l’airflare avec swing, placer la main d’impulsion comme sur un 1990 et retomber de l’airflare en flare.",
   "de": "Flare – Airflare – Flare für erfahrene B-Boys. Aus dem Flare mit der Hüfte nach oben, Absprung aus dem Pike, der geschwungene Airflare, die Abdruckhand wie bei der 1990 setzen und aus dem Airflare zurück in den Flare.",
   "ja": "経験者向けのフレア→エアフレア→フレア。腰を上げてフレアから抜ける、パイクから跳ぶ、振りを使ったエアフレア、押す手を1990のように置く、そしてエアフレアからフレアへの着地。",
   "ko": "숙련된 비보이를 위한 플레어 – 에어플레어 – 플레어. 골반을 위로 올리며 플레어에서 나오기, 파이크에서 점프, 스윙 에어플레어, 미는 손을 1990처럼 짚기, 그리고 에어플레어에서 다시 플레어로 착지.",
   "zh": "给有经验的 b-boy：flare – airflare – flare。臀部朝上从 flare 出来、从 pike 起跳、带摆动的 airflare、像 1990 那样放推手，以及从 airflare 落回 flare。"
  }
 },
 {
  "id": "pw-flare-wm",
  "sec": "Transitions",
  "name": "Flare → Windmill → Flare",
  "dur": 533,
  "ru": "флаер флэр виндмил мельница",
  "added": "2026-10-29",
  "pv": true,
  "ks": "fcbcbb79-43ca-482d-b0f2-01472155230a",
  "desc": {
   "ru": "Связка флай — гелик — флай. Как остановиться на правой руке с высоким тазом, два способа сойти с флая в гелик, какая высота таза нужна для разных геликов и два упражнения для выхода из гелика во флай.",
   "en": "The flare – windmill – flare combo. How to stop on your right hand with your hips high, two ways to drop from a flare into a windmill, how hip height changes the windmill, and two drills for coming out of the windmill into a flare.",
   "es": "El combo flare – windmill – flare. Cómo frenar en la mano derecha con la cadera alta, dos formas de bajar del flare al windmill, cómo la altura de la cadera cambia el windmill y dos ejercicios para salir del windmill al flare.",
   "pt": "O combo flare – windmill – flare. Como parar na mão direita com o quadril alto, duas formas de descer do flare para o windmill, como a altura do quadril muda o windmill e dois exercícios para sair do windmill para o flare.",
   "fr": "Le combo flare – windmill – flare. S’arrêter sur la main droite bassin haut, deux façons de descendre du flare dans le windmill, l’effet de la hauteur du bassin sur le windmill et deux exercices pour sortir du windmill en flare.",
   "de": "Die Kombo Flare – Windmill – Flare. Wie du mit hoher Hüfte auf der rechten Hand stoppst, zwei Wege vom Flare in die Windmill, wie die Hüfthöhe die Windmill verändert, und zwei Übungen für den Weg aus der Windmill in den Flare.",
   "ja": "フレア→ウィンドミル→フレアのコンビネーション。腰を高くして右手で止まる方法、フレアからウィンドミルへ降りる2つのやり方、腰の高さでウィンドミルがどう変わるか、そしてウィンドミルからフレアへ出るための2つのドリル。",
   "ko": "플레어 – 윈드밀 – 플레어 콤보. 골반을 높게 두고 오른손에서 멈추는 법, 플레어에서 윈드밀로 내려가는 두 가지 방법, 골반 높이에 따라 윈드밀이 어떻게 달라지는지, 그리고 윈드밀에서 플레어로 나가기 위한 두 가지 연습.",
   "zh": "flare – windmill – flare 组合。怎样用右手停住并保持高臀位，从 flare 落到 windmill 的两种方法，臀部高度如何改变 windmill，以及从 windmill 出到 flare 的两个练习。"
  }
 },
 {
  "id": "pw-flare-1990",
  "sec": "Transitions",
  "name": "Flare → 1990 → Flare",
  "dur": 419,
  "ru": "флаер флэр 1990 девяностый",
  "added": "2026-10-29",
  "pv": true,
  "ks": "9646f680-1ae0-4b57-99f3-d1b8ea41cb7f",
  "desc": {
   "ru": "Связка флай — 1990 — флай. Зачем нужен спичак, как толчок левой ногой выводит в 1990 без чирканья ногой, как работает правая рука и как сойти из 1990 обратно во флай.",
   "en": "The flare – 1990 – flare combo. Why you need a press handstand, how a push of the left leg gets you up into the 1990 without scraping your foot, what the right arm does, and how to come down from the 1990 back into a flare.",
   "es": "El combo flare – 1990 – flare. Por qué necesitas el press handstand, cómo un empuje de la pierna izquierda te sube al 1990 sin arrastrar el pie, qué hace el brazo derecho y cómo bajar del 1990 de vuelta al flare.",
   "pt": "O combo flare – 1990 – flare. Por que você precisa do press handstand, como um impulso da perna esquerda te leva ao 1990 sem arrastar o pé, o que faz o braço direito e como descer do 1990 de volta para o flare.",
   "fr": "Le combo flare – 1990 – flare. Pourquoi il faut le press handstand, comment une poussée de la jambe gauche te monte dans le 1990 sans frotter le pied, le rôle du bras droit et comment redescendre du 1990 dans le flare.",
   "de": "Die Kombo Flare – 1990 – Flare. Warum du den Press-Handstand brauchst, wie dich ein Stoß mit dem linken Bein in die 1990 bringt, ohne mit dem Fuß zu schleifen, was der rechte Arm macht und wie du aus der 1990 zurück in den Flare kommst.",
   "ja": "フレア→1990→フレアのコンビネーション。プレスハンドスタンドが必要な理由、左脚の押しで足を擦らずに1990へ上がる方法、右腕の使い方、そして1990からフレアへ戻る降り方。",
   "ko": "플레어 – 1990 – 플레어 콤보. 프레스 핸드스탠드가 필요한 이유, 왼다리 푸시로 발을 끌지 않고 1990으로 올라가는 법, 오른팔의 역할, 그리고 1990에서 다시 플레어로 내려오는 법.",
   "zh": "flare – 1990 – flare 组合。为什么需要 press handstand，怎样用左腿一推上到 1990 而不蹭脚，右臂怎么发力，以及怎样从 1990 落回 flare。"
  }
 },
 {
  "id": "pw-swipes-flare",
  "sec": "Transitions",
  "name": "Swipes → Flare → Swipes",
  "dur": 436,
  "ru": "свайпы свайп флаер флэр",
  "added": "2026-10-29",
  "pv": true,
  "ks": "6faac4e1-de8a-4952-8d09-6134e13ee34a",
  "desc": {
   "ru": "Связка свайпс — флай — свайпс. Как выйти с флая в свайпс, не ломая плечо, и как со свайпса выйти во флай: держать угол, не затягивать выход в руки и куда кидать правую руку.",
   "en": "The swipes – flare – swipes combo. How to go from a flare into swipes without collapsing your shoulder, and from swipes into a flare: keeping the angle, not hanging too long on your hands, and where to throw your right hand.",
   "es": "El combo swipes – flare – swipes. Cómo pasar del flare a los swipes sin que se te hunda el hombro y de los swipes al flare: mantener el ángulo, no quedarte demasiado en las manos y hacia dónde lanzar la mano derecha.",
   "pt": "O combo swipes – flare – swipes. Como sair do flare para os swipes sem desmontar o ombro e dos swipes para o flare: manter o ângulo, não demorar nas mãos e para onde jogar a mão direita.",
   "fr": "Le combo swipes – flare – swipes. Passer du flare aux swipes sans casser l’épaule, et des swipes au flare : garder l’angle, ne pas traîner sur les mains et où lancer la main droite.",
   "de": "Die Kombo Swipes – Flare – Swipes. Wie du vom Flare in die Swipes kommst, ohne dass die Schulter einknickt, und von den Swipes in den Flare: Winkel halten, nicht zu lange auf den Händen bleiben und wohin die rechte Hand geht.",
   "ja": "スワイプス→フレア→スワイプスのコンビネーション。肩を崩さずにフレアからスワイプスへ出る方法と、スワイプスからフレアへ出る方法：角度を保つ、手で止まりすぎない、右手をどこへ投げるか。",
   "ko": "스와이프스 – 플레어 – 스와이프스 콤보. 어깨가 무너지지 않게 플레어에서 스와이프스로 나가는 법, 그리고 스와이프스에서 플레어로 나가는 법: 각도 유지, 손 위에서 너무 오래 머물지 않기, 오른손을 어디로 던질지.",
   "zh": "swipes – flare – swipes 组合。怎样从 flare 进入 swipes 而不塌肩，以及怎样从 swipes 出到 flare：保持角度、不要在手上停太久、右手往哪里甩。"
  }
 }
];
