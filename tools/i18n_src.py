# Source of i18n.js: key = Russian text, value = [en, es, pt, fr, de, ja, ko, zh]
L = ['en', 'es', 'pt', 'fr', 'de', 'ja', 'ko', 'zh']
D = {}
def t(ru, *vals):
    assert len(vals) == 8, ru
    D[ru] = dict(zip(L, vals))

# ---- navigation / tabs ----
t('Главная', 'Home', 'Inicio', 'Início', 'Accueil', 'Start', 'ホーム', '홈', '首页')
t('Подробнее', 'Details', 'Detalles', 'Detalhes', 'Détails', 'Details', '詳細', '자세히', '详情')
t('Следующий урок', 'Next lesson', 'Siguiente lección', 'Próxima aula', 'Leçon suivante', 'Nächste Lektion', '次のレッスン', '다음 레슨', '下一课')
t('Предыдущий урок', 'Previous lesson', 'Lección anterior', 'Aula anterior', 'Leçon précédente', 'Vorherige Lektion', '前のレッスン', '이전 레슨', '上一课')
t('Это последний урок раздела', 'This is the last lesson in the section', 'Es la última lección de la sección', 'Esta é a última aula da seção', "C'est la dernière leçon de la section", 'Das ist die letzte Lektion im Bereich', 'このセクションの最後のレッスンです', '이 섹션의 마지막 레슨이에요', '这是本部分的最后一课')
t('Это первый урок раздела', 'This is the first lesson in the section', 'Es la primera lección de la sección', 'Esta é a primeira aula da seção', "C'est la première leçon de la section", 'Das ist die erste Lektion im Bereich', 'このセクションの最初のレッスンです', '이 섹션의 첫 번째 레슨이에요', '这是本部分的第一课')
t('Листай вбок — соседний урок', 'Swipe sideways for the next lesson', 'Desliza de lado para otra lección', 'Deslize para o lado para outra aula', 'Glisse sur le côté pour changer de leçon', 'Zur Seite wischen für die nächste Lektion', '左右にスワイプで隣のレッスン', '옆으로 밀어 다른 레슨 보기', '左右滑动切换课程')
t('Разбор', 'Review', 'Revisión', 'Análise', 'Analyse', 'Feedback', '添削', '피드백', '点评')
t('Профиль', 'Profile', 'Perfil', 'Perfil', 'Profil', 'Profil', 'プロフィール', '프로필', '我的')
t('Основное меню', 'Main menu', 'Menú principal', 'Menu principal', 'Menu principal', 'Hauptmenü', 'メインメニュー', '메인 메뉴', '主菜单')
t('Язык приложения', 'App language', 'Idioma de la app', 'Idioma do app', "Langue de l'app", 'App-Sprache', 'アプリの言語', '앱 언어', '应用语言')
t('Язык', 'Language', 'Idioma', 'Idioma', 'Langue', 'Sprache', '言語', '언어', '语言')
t('Назад', 'Back', 'Atrás', 'Voltar', 'Retour', 'Zurück', '戻る', '뒤로', '返回')
t('Назад к разделу', 'Back to section', 'Volver a la sección', 'Voltar à seção', 'Retour à la section', 'Zurück zum Bereich', 'カテゴリーに戻る', '카테고리로 돌아가기', '返回分类')
t('Раздел', 'Section', 'Sección', 'Seção', 'Section', 'Bereich', 'カテゴリー', '카테고리', '分类')
t('Урок', 'Lesson', 'Lección', 'Aula', 'Leçon', 'Lektion', 'レッスン', '레슨', '课程')
t('Закрыть', 'Close', 'Cerrar', 'Fechar', 'Fermer', 'Schließen', '閉じる', '닫기', '关闭')
t('Готово', 'Done', 'Listo', 'Pronto', 'OK', 'Fertig', '完了', '완료', '完成')
t('Позже', 'Later', 'Más tarde', 'Mais tarde', 'Plus tard', 'Später', 'あとで', '나중에', '稍后')
t('Сохранить', 'Save', 'Guardar', 'Salvar', 'Enregistrer', 'Speichern', '保存', '저장', '收藏')
t('Сохранено', 'Saved', 'Guardado', 'Salvo', 'Enregistré', 'Gespeichert', '保存済み', '저장됨', '已收藏')
t('Сохранённое', 'Saved', 'Guardados', 'Salvos', 'Enregistrés', 'Gespeichert', '保存済み', '저장한 레슨', '收藏')
t('Все', 'All', 'Todo', 'Tudo', 'Tout', 'Alle', 'すべて', '전체', '全部')
t('Скоро', 'Soon', 'Pronto', 'Em breve', 'Bientôt', 'Bald', '近日公開', '곧 공개', '即将上线')

# ---- home ----
t('Все уроки бесплатно на время альфа-теста', 'All lessons are free during the alpha test', 'Todas las lecciones son gratis durante la prueba alfa', 'Todas as aulas são grátis durante o teste alfa', "Toutes les leçons sont gratuites pendant l'alpha", 'Alle Lektionen sind während des Alpha-Tests kostenlos', 'アルファテスト中は全レッスン無料', '알파 테스트 기간 동안 모든 레슨 무료', '内测期间所有课程免费')
t('Все уроки бесплатно на время альфа-теста.', 'All lessons are free during the alpha test.', 'Todas las lecciones son gratis durante la prueba alfa.', 'Todas as aulas são grátis durante o teste alfa.', "Toutes les leçons sont gratuites pendant l'alpha.", 'Alle Lektionen sind während des Alpha-Tests kostenlos.', 'アルファテスト中は全レッスン無料です。', '알파 테스트 기간 동안 모든 레슨이 무료입니다.', '内测期间所有课程免费。')
t('Найти элемент: windmill, 6-step…', 'Find a move: windmill, 6-step…', 'Buscar un paso: windmill, 6-step…', 'Buscar um passo: windmill, 6-step…', 'Chercher un move : windmill, 6-step…', 'Move suchen: windmill, 6-step…', '技を検索：windmill、6-step…', '기술 검색: windmill, 6-step…', '搜索动作：windmill、6-step…')
t('Поиск элемента', 'Search moves', 'Buscar pasos', 'Buscar passos', 'Chercher un move', 'Moves suchen', '技を検索', '기술 검색', '搜索动作')
t('Очистить поиск', 'Clear search', 'Borrar búsqueda', 'Limpar busca', 'Effacer la recherche', 'Suche löschen', '検索をクリア', '검색 지우기', '清除搜索')
t('Разделы', 'Sections', 'Secciones', 'Seções', 'Sections', 'Bereiche', 'カテゴリー', '카테고리', '分类')
t('{n} видео', '{n} videos', '{n} videos', '{n} vídeos', '{n} vidéos', '{n} Videos', '動画{n}本', '영상 {n}개', '{n} 个视频')
t('1 видео', '1 video', '1 video', '1 vídeo', '1 vidéo', '1 Video', '動画1本', '영상 1개', '1 个视频')
t('{sec}, есть новые видео', '{sec}, new videos', '{sec}, videos nuevos', '{sec}, vídeos novos', '{sec}, nouvelles vidéos', '{sec}, neue Videos', '{sec}、新しい動画あり', '{sec}, 새 영상 있음', '{sec}，有新视频')
t('Бесплатно', 'Free', 'Gratis', 'Grátis', 'Gratuit', 'Kostenlos', '無料', '무료', '免费')
t(', бесплатно', ', free', ', gratis', ', grátis', ', gratuit', ', kostenlos', '、無料', ', 무료', '，免费')
t('Уроки этого раздела скоро появятся.', 'Lessons for this section are coming soon.', 'Las lecciones de esta sección llegarán pronto.', 'As aulas desta seção chegam em breve.', 'Les leçons de cette section arrivent bientôt.', 'Lektionen für diesen Bereich kommen bald.', 'このカテゴリーのレッスンは近日公開です。', '이 카테고리의 레슨은 곧 공개됩니다.', '该分类的课程即将上线。')
t('Ничего не нашли по запросу «{q}». Попробуй по-английски, например 6-step или monkey flip.',
  'Nothing found for “{q}”. Try the English name, e.g. 6-step or monkey flip.',
  'No encontramos nada para «{q}». Prueba el nombre en inglés, p. ej. 6-step o monkey flip.',
  'Nada encontrado para “{q}”. Tente o nome em inglês, por exemplo 6-step ou monkey flip.',
  'Aucun résultat pour « {q} ». Essaie le nom anglais, par ex. 6-step ou monkey flip.',
  'Nichts gefunden für „{q}“. Versuch den englischen Namen, z. B. 6-step oder monkey flip.',
  '「{q}」は見つかりませんでした。英語名で検索してみて（例：6-step、monkey flip）。',
  '“{q}”에 대한 결과가 없어요. 영어 이름으로 검색해 보세요. 예: 6-step, monkey flip',
  '没有找到“{q}”。试试英文名，例如 6-step 或 monkey flip。')

# ---- lesson / player ----
t('Видео не загрузилось. Проверь интернет и открой урок ещё раз.', "The video didn't load. Check your internet and open the lesson again.", 'El video no cargó. Revisa tu conexión y abre la lección de nuevo.', 'O vídeo não carregou. Verifique a internet e abra a aula de novo.', "La vidéo ne s'est pas chargée. Vérifie ta connexion et rouvre la leçon.", 'Das Video wurde nicht geladen. Prüf dein Internet und öffne die Lektion erneut.', '動画を読み込めませんでした。通信状況を確認して、もう一度レッスンを開いてください。', '영상을 불러오지 못했어요. 인터넷을 확인하고 레슨을 다시 열어 주세요.', '视频未能加载。请检查网络后重新打开课程。')
t('Проверить на своём видео', 'Try on your own video', 'Probar con tu propio video', 'Testar com seu próprio vídeo', 'Essayer sur ta propre vidéo', 'Mit eigenem Video prüfen', '自分の動画で確認', '내 영상으로 확인', '用自己的视频对照')
t('Зеркало', 'Mirror', 'Espejo', 'Espelho', 'Miroir', 'Spiegeln', 'ミラー', '미러', '镜像')
t('Повтор', 'Loop', 'Bucle', 'Repetir', 'Boucle', 'Schleife', 'リピート', '반복', '循环')
t('Твоё видео', 'Your video', 'Tu video', 'Seu vídeo', 'Ta vidéo', 'Dein Video', 'あなたの動画', '내 영상', '你的视频')
t('Звук', 'Sound', 'Sonido', 'Som', 'Son', 'Ton', 'サウンド', '소리', '声音')
t('Во весь экран', 'Full screen', 'Pantalla completa', 'Tela cheia', 'Plein écran', 'Vollbild', '全画面', '전체 화면', '全屏')
t('Выйти из полноэкранного режима', 'Exit full screen', 'Salir de pantalla completa', 'Sair da tela cheia', 'Quitter le plein écran', 'Vollbild beenden', '全画面を終了', '전체 화면 종료', '退出全屏')
t('Повернуть видео', 'Rotate video', 'Girar video', 'Girar vídeo', 'Pivoter la vidéo', 'Video drehen', '動画を回転', '영상 회전', '旋转视频')
t('Перемотка', 'Seek', 'Avanzar', 'Avançar', 'Avancer', 'Spulen', 'シーク', '탐색', '进度')
t('Назад на 5 секунд', 'Back 5 seconds', 'Atrás 5 segundos', 'Voltar 5 segundos', 'Reculer de 5 secondes', '5 Sekunden zurück', '5秒戻る', '5초 뒤로', '后退 5 秒')
t('Смотреть', 'Play', 'Reproducir', 'Assistir', 'Lire', 'Abspielen', '再生', '재생', '播放')
t('Пауза', 'Pause', 'Pausa', 'Pausar', 'Pause', 'Pause', '一時停止', '일시정지', '暂停')
t('Скорость', 'Speed', 'Velocidad', 'Velocidade', 'Vitesse', 'Tempo', '速度', '속도', '速度')
t('Повтор 3 секунд', 'Loop 3 seconds', 'Bucle de 3 segundos', 'Repetir 3 segundos', 'Boucle de 3 secondes', '3 Sekunden wiederholen', '3秒リピート', '3초 반복', '循环 3 秒')
t('Повтор 3 сек', 'Loop 3 s', 'Bucle 3 s', 'Repetir 3 s', 'Boucle 3 s', 'Loop 3 s', '3秒リピート', '3초 반복', '循环 3 秒')
t('5 сек', '5 s', '5 s', '5 s', '5 s', '5 s', '5秒', '5초', '5 秒')
t('Скачать', 'Download', 'Descargar', 'Baixar', 'Télécharger', 'Download', 'ダウンロード', '다운로드', '下载')
t('Скачано', 'Downloaded', 'Descargado', 'Baixado', 'Téléchargé', 'Geladen', 'ダウンロード済み', '다운로드됨', '已下载')
t('Включить звук', 'Turn sound on', 'Activar sonido', 'Ativar som', 'Activer le son', 'Ton an', '音声オン', '소리 켜기', '打开声音')
t('Выключить звук', 'Turn sound off', 'Silenciar', 'Desativar som', 'Couper le son', 'Ton aus', '音声オフ', '소리 끄기', '关闭声音')
t('Замедление, зеркало и повтор 3 сек помогут разобрать движение. Повтор зацикливает момент, на котором стоит видео.',
  'Slow motion, mirror and 3-second loop help you break down the move. Loop repeats the moment where the video is now.',
  'La cámara lenta, el espejo y el bucle de 3 s te ayudan a entender el paso. El bucle repite el momento donde está el video.',
  'Câmera lenta, espelho e repetição de 3 s ajudam a entender o passo. A repetição fica no trecho em que o vídeo está.',
  'Ralenti, miroir et boucle de 3 s t’aident à décortiquer le move. La boucle répète le moment où se trouve la vidéo.',
  'Zeitlupe, Spiegeln und 3-Sekunden-Loop helfen dir, den Move zu verstehen. Der Loop wiederholt die aktuelle Stelle im Video.',
  'スロー、ミラー、3秒リピートで動きを細かく確認できます。リピートは今の再生位置を繰り返します。',
  '슬로우, 미러, 3초 반복으로 동작을 자세히 분석하세요. 반복은 현재 재생 중인 구간을 되풀이합니다.',
  '慢放、镜像和 3 秒循环帮你拆解动作。循环会重复视频当前所在的片段。')
t('Обычная скорость.', 'Normal speed.', 'Velocidad normal.', 'Velocidade normal.', 'Vitesse normale.', 'Normales Tempo.', '通常速度。', '보통 속도.', '正常速度。')
t('Замедление {r}x — смотри, как ставятся ноги и куда переносится вес.',
  'Slow motion {r}x — watch where the feet land and how the weight shifts.',
  'Cámara lenta {r}x — fíjate dónde apoyan los pies y cómo se pasa el peso.',
  'Câmera lenta {r}x — veja onde os pés apoiam e como o peso se transfere.',
  'Ralenti {r}x — regarde où se posent les pieds et comment le poids se déplace.',
  'Zeitlupe {r}x — achte darauf, wo die Füße landen und wie sich das Gewicht verlagert.',
  'スロー {r}x — 足の置き方と体重移動を見てみよう。',
  '슬로우 {r}x — 발 위치와 체중 이동을 잘 보세요.',
  '慢放 {r}x — 注意脚怎么落地、重心怎么转移。')
t('Зеркало включено: повторяй движения, как перед зеркалом в зале.', 'Mirror on: copy the moves like in front of a studio mirror.', 'Espejo activado: repite los pasos como frente al espejo del estudio.', 'Espelho ligado: repita os passos como na frente do espelho do estúdio.', 'Miroir activé : refais les moves comme devant le miroir de la salle.', 'Spiegeln an: mach die Moves nach wie vor dem Spiegel im Studio.', 'ミラーON：スタジオの鏡の前のように真似しよう。', '미러 켜짐: 연습실 거울 앞처럼 따라 해 보세요.', '镜像已开：像对着练功房的镜子一样跟着做。')
t('Зеркало выключено.', 'Mirror off.', 'Espejo desactivado.', 'Espelho desligado.', 'Miroir désactivé.', 'Spiegeln aus.', 'ミラーOFF。', '미러 꺼짐.', '镜像已关。')
t('Повтор выключен.', 'Loop off.', 'Bucle desactivado.', 'Repetição desligada.', 'Boucle désactivée.', 'Loop aus.', 'リピートOFF。', '반복 꺼짐.', '循环已关。')
t('Фрагмент {a}–{b} повторяется по кругу. Включи замедление, чтобы разобрать его.',
  'The part {a}–{b} is on loop. Turn on slow motion to break it down.',
  'El fragmento {a}–{b} se repite en bucle. Activa la cámara lenta para analizarlo.',
  'O trecho {a}–{b} está repetindo. Ative a câmera lenta para analisar.',
  'Le passage {a}–{b} tourne en boucle. Active le ralenti pour le décortiquer.',
  'Der Abschnitt {a}–{b} läuft in Schleife. Schalte Zeitlupe ein, um ihn zu verstehen.',
  '{a}–{b} をリピート中。スローにすると細かく確認できます。',
  '{a}–{b} 구간을 반복 중이에요. 슬로우를 켜서 분석해 보세요.',
  '正在循环 {a}–{b}。打开慢放来拆解动作。')
t('Удалено из загрузок', 'Removed from downloads', 'Eliminado de descargas', 'Removido dos downloads', 'Supprimé des téléchargements', 'Aus Downloads entfernt', 'ダウンロードから削除しました', '다운로드에서 삭제됨', '已从下载中删除')
t('Урок доступен без интернета', 'Lesson available offline', 'Lección disponible sin internet', 'Aula disponível offline', 'Leçon disponible hors ligne', 'Lektion offline verfügbar', 'オフラインで見られます', '오프라인으로 볼 수 있어요', '课程可离线观看')
t('Твоё видео загружено — проверь замедление и зеркало', 'Your video is loaded — try slow motion and mirror', 'Tu video está cargado — prueba la cámara lenta y el espejo', 'Seu vídeo foi carregado — teste a câmera lenta e o espelho', 'Ta vidéo est chargée — essaie le ralenti et le miroir', 'Dein Video ist geladen — probier Zeitlupe und Spiegeln', '動画を読み込みました — スローとミラーを試してみて', '영상이 불러와졌어요 — 슬로우와 미러를 써 보세요', '视频已载入 — 试试慢放和镜像')
t('Ещё в разделе', 'More in this section', 'Más en esta sección', 'Mais nesta seção', 'Plus dans cette section', 'Mehr in diesem Bereich', 'このカテゴリーの他のレッスン', '이 카테고리의 다른 레슨', '本分类更多课程')
t('Другие уроки раздела скоро появятся.', 'More lessons for this section are coming soon.', 'Pronto habrá más lecciones en esta sección.', 'Mais aulas desta seção chegam em breve.', "D'autres leçons arrivent bientôt dans cette section.", 'Weitere Lektionen für diesen Bereich kommen bald.', 'このカテゴリーの他のレッスンは近日公開です。', '이 카테고리의 다른 레슨은 곧 공개됩니다.', '本分类的更多课程即将上线。')
t('{sec} · урок {n} из {m} · {dur}', '{sec} · lesson {n} of {m} · {dur}', '{sec} · lección {n} de {m} · {dur}', '{sec} · aula {n} de {m} · {dur}', '{sec} · leçon {n} sur {m} · {dur}', '{sec} · Lektion {n} von {m} · {dur}', '{sec} · レッスン {n}/{m} · {dur}', '{sec} · 레슨 {n}/{m} · {dur}', '{sec} · 第 {n}/{m} 课 · {dur}')
t('[Описание урока: что разбираем, на что обратить внимание, частые ошибки]', '[Lesson description: what we cover, what to watch for, common mistakes]', '[Descripción: qué vemos, en qué fijarse, errores comunes]', '[Descrição: o que vamos ver, no que prestar atenção, erros comuns]', '[Description : ce qu’on travaille, à quoi faire attention, erreurs fréquentes]', '[Beschreibung: was wir lernen, worauf du achten solltest, typische Fehler]', '[説明：内容、注意点、よくあるミス]', '[설명: 다루는 내용, 주의할 점, 흔한 실수]', '[课程说明：讲什么、注意什么、常见错误]')
t('Убрано из сохранённого', 'Removed from saved', 'Quitado de guardados', 'Removido dos salvos', 'Retiré des enregistrés', 'Aus Gespeichert entfernt', '保存を解除しました', '저장에서 삭제됨', '已取消收藏')
t('Сохранено — урок на главной и в профиле', 'Saved — find it on Home and in your Profile', 'Guardado — lo verás en Inicio y en tu Perfil', 'Salvo — está no Início e no seu Perfil', 'Enregistré — retrouve-le sur l’Accueil et dans ton Profil', 'Gespeichert — du findest es auf Start und im Profil', '保存しました — ホームとプロフィールにあります', '저장됨 — 홈과 프로필에서 볼 수 있어요', '已收藏 — 可在首页和“我的”里找到')
t('Сохраняй уроки кнопкой «Сохранить», чтобы быстро к ним возвращаться.', 'Tap “Save” on a lesson to get back to it quickly.', 'Toca «Guardar» en una lección para volver rápido a ella.', 'Toque em “Salvar” numa aula para voltar a ela rápido.', 'Appuie sur « Enregistrer » pour retrouver vite une leçon.', 'Tippe bei einer Lektion auf „Speichern“, um schnell zurückzukommen.', 'レッスンの「保存」を押すと、すぐに見返せます。', '레슨에서 “저장”을 누르면 빠르게 다시 볼 수 있어요.', '点课程里的“收藏”，下次就能快速找到。')

# ---- review ----
t('Пришли видео своего элемента или раунда — создатель приложения лично разберёт ошибки и подскажет, что тренировать дальше.',
  'Send a video of your move or round — the creator of the app will personally point out mistakes and tell you what to train next.',
  'Envía un video de tu paso o ronda — el creador de la app revisará tus errores en persona y te dirá qué entrenar después.',
  'Envie um vídeo do seu passo ou round — o criador do app vai analisar seus erros pessoalmente e dizer o que treinar depois.',
  'Envoie une vidéo de ton move ou de ton passage — le créateur de l’app analysera lui-même tes erreurs et te dira quoi travailler ensuite.',
  'Schick ein Video von deinem Move oder deiner Runde — der Macher der App zeigt dir persönlich deine Fehler und was du als Nächstes trainieren solltest.',
  '技やラウンドの動画を送ってね。アプリの制作者が直接ミスをチェックして、次に練習すべきことを教えます。',
  '기술이나 라운드 영상을 보내 주세요. 앱 제작자가 직접 실수를 짚어 주고 다음에 연습할 것을 알려 줍니다.',
  '发送你的动作或整段 round 的视频 — 应用作者会亲自指出问题，并告诉你接下来练什么。')
t('Сними видео', 'Film a video', 'Graba un video', 'Grave um vídeo', 'Filme une vidéo', 'Film ein Video', '動画を撮る', '영상 찍기', '拍视频')
t('Элемент или раунд, до [N] минут', 'A move or a round, up to [N] minutes', 'Un paso o una ronda, hasta [N] minutos', 'Um passo ou um round, até [N] minutos', 'Un move ou un passage, jusqu’à [N] minutes', 'Ein Move oder eine Runde, bis [N] Minuten', '技またはラウンド、[N]分まで', '기술 또는 라운드, 최대 [N]분', '单个动作或整段 round，不超过 [N] 分钟')
t('Напиши в Telegram', 'Message me on Telegram', 'Escríbeme por Telegram', 'Me mande mensagem no Telegram', 'Écris-moi sur Telegram', 'Schreib mir auf Telegram', 'Telegramでメッセージ', '텔레그램으로 메시지', '在 Telegram 上发消息')
t('Пришли видео и оплати разбор', 'Send the video and pay for the review', 'Envía el video y paga la revisión', 'Envie o vídeo e pague a análise', 'Envoie la vidéo et paie l’analyse', 'Schick das Video und bezahl das Feedback', '動画を送って添削料を支払う', '영상을 보내고 피드백 비용을 결제', '发送视频并支付点评费用')
t('Получи разбор', 'Get your review', 'Recibe tu revisión', 'Receba sua análise', 'Reçois ton analyse', 'Erhalte dein Feedback', '添削を受け取る', '피드백 받기', '收到点评')
t('Видео с разбором в течение {h}', 'Video review within {h}', 'Video con la revisión en {h}', 'Vídeo com a análise em até {h}', 'Vidéo d’analyse sous {h}', 'Video-Feedback innerhalb von {h}', '{h}以内に添削動画', '{h} 이내 피드백 영상', '{h} 内收到点评视频')
t('{n} ч', '{n} h', '{n} h', '{n} h', '{n} h', '{n} Std.', '{n}時間', '{n}시간', '{n} 小时')
t('Что ты получишь', 'What you get', 'Qué recibes', 'O que você recebe', 'Ce que tu reçois', 'Was du bekommst', '受け取れるもの', '받을 수 있는 것', '你会得到')
t('Видео-ответ с разбором ошибок', 'A video reply breaking down your mistakes', 'Un video de respuesta con tus errores explicados', 'Um vídeo de resposta explicando seus erros', 'Une vidéo de réponse qui décortique tes erreurs', 'Eine Video-Antwort, die deine Fehler erklärt', 'ミスを解説する返信動画', '실수를 분석한 답변 영상', '一段讲解你问题的回复视频')
t('Упражнения под твой уровень', 'Drills for your level', 'Ejercicios para tu nivel', 'Exercícios para o seu nível', 'Des exercices adaptés à ton niveau', 'Übungen für dein Level', 'レベルに合った練習メニュー', '내 수준에 맞는 연습법', '适合你水平的练习')
t('Один уточняющий вопрос после разбора', 'One follow-up question after the review', 'Una pregunta extra después de la revisión', 'Uma pergunta extra depois da análise', 'Une question de suivi après l’analyse', 'Eine Rückfrage nach dem Feedback', '添削後に1回質問できる', '피드백 후 추가 질문 1회', '点评后可追问一次')
t('Отправить на разбор', 'Send for review', 'Enviar a revisión', 'Enviar para análise', 'Envoyer pour analyse', 'Für Feedback senden', '添削を申し込む', '피드백 신청', '提交点评')
t('{rub} · {usd} · видео с разбором в течение {h}', '{usd} · {rub} · video review within {h}', '{usd} · {rub} · video con la revisión en {h}', '{usd} · {rub} · vídeo com a análise em até {h}', '{usd} · {rub} · vidéo d’analyse sous {h}', '{usd} · {rub} · Video-Feedback innerhalb von {h}', '{usd} · {rub} · {h}以内に添削動画', '{usd} · {rub} · {h} 이내 피드백 영상', '{usd} · {rub} · {h} 内收到点评视频')
t('Отправить', 'Send', 'Enviar', 'Enviar', 'Envoyer', 'Senden', '添削を', '피드백', '提交')
t('на разбор', 'for review', 'a revisión', 'para análise', 'pour analyse', 'für Feedback', '申し込む', '신청', '点评')
t('Всё через Telegram', 'Everything via Telegram', 'Todo por Telegram', 'Tudo pelo Telegram', 'Tout passe par Telegram', 'Alles über Telegram', 'すべてTelegramで', '모두 텔레그램으로', '全部通过 Telegram')
t('Выбери формат и нажми кнопку внизу — откроется чат с создателем приложения, где ты пришлёшь видео и оплатишь разбор.',
  'Choose a format and tap the button below — a chat with the creator of the app will open, where you send your video and pay for the review.',
  'Elige el formato y toca el botón de abajo — se abrirá un chat con el creador de la app, donde envías tu video y pagas la revisión.',
  'Escolha o formato e toque no botão abaixo — vai abrir um chat com o criador do app, onde você envia o vídeo e paga a análise.',
  'Choisis le format et appuie sur le bouton en bas — un chat avec le créateur de l’app s’ouvrira : tu y envoies ta vidéo et tu paies l’analyse.',
  'Wähle das Format und tippe unten auf den Button — es öffnet sich ein Chat mit dem Macher der App. Dort schickst du dein Video und bezahlst das Feedback.',
  '形式を選んで下のボタンを押すと、アプリ制作者とのチャットが開きます。そこで動画を送り、添削料を支払ってください。',
  '형식을 고르고 아래 버튼을 누르면 앱 제작자와의 채팅이 열려요. 거기서 영상을 보내고 피드백 비용을 결제하세요.',
  '选好形式后点下面的按钮，会打开和应用作者的聊天，在那里发视频并付款。')
t('Формат разбора', 'Review format', 'Formato de revisión', 'Formato da análise', 'Format de l’analyse', 'Feedback-Format', '添削の形式', '피드백 형식', '点评形式')
t('Один элемент', 'One move', 'Un paso', 'Um passo', 'Un move', 'Ein Move', '技ひとつ', '기술 하나', '单个动作')
t('Например, windmill или freeze', 'For example, a windmill or a freeze', 'Por ejemplo, un windmill o un freeze', 'Por exemplo, um windmill ou um freeze', 'Par exemple, un windmill ou un freeze', 'Zum Beispiel Windmill oder Freeze', '例：windmill、freeze', '예: windmill, freeze', '例如 windmill 或 freeze')
t('Полный раунд', 'Full round', 'Ronda completa', 'Round completo', 'Passage complet', 'Ganze Runde', 'ラウンド全体', '라운드 전체', '完整 round')
t('Связки, музыкальность, переходы', 'Combos, musicality, transitions', 'Combinaciones, musicalidad, transiciones', 'Combinações, musicalidade, transições', 'Enchaînements, musicalité, transitions', 'Kombos, Musikalität, Übergänge', 'コンボ、音ハメ、つなぎ', '콤보, 음악성, 연결 동작', '连招、音乐性、衔接')
t('Условия', 'Terms', 'Condiciones', 'Condições', 'Conditions', 'Bedingungen', '条件', '조건', '说明')
t('• Разбор делает лично создатель приложения', '• The creator of the app does every review personally', '• El creador de la app hace cada revisión en persona', '• O criador do app faz cada análise pessoalmente', '• Le créateur de l’app fait chaque analyse lui-même', '• Der Macher der App gibt jedes Feedback persönlich', '• 添削はアプリ制作者本人が行います', '• 모든 피드백은 앱 제작자가 직접 합니다', '• 每次点评都由应用作者亲自完成')
t('• Видео и оплата — в Telegram', '• Video and payment — in Telegram', '• Video y pago — por Telegram', '• Vídeo e pagamento — pelo Telegram', '• Vidéo et paiement — sur Telegram', '• Video und Bezahlung — über Telegram', '• 動画と支払いはTelegramで', '• 영상과 결제는 텔레그램에서', '• 视频和付款都在 Telegram 里完成')
t('• Вы получите видео с разбором в течение {h} после оплаты', '• You get your video review within {h} after payment', '• Recibes el video con la revisión en {h} después del pago', '• Você recebe o vídeo com a análise em até {h} após o pagamento', '• Tu reçois ta vidéo d’analyse sous {h} après le paiement', '• Du bekommst dein Video-Feedback innerhalb von {h} nach der Zahlung', '• お支払い後{h}以内に添削動画が届きます', '• 결제 후 {h} 이내에 피드백 영상을 받아요', '• 付款后 {h} 内收到点评视频')
t('• Формат ответа — видео с разбором ошибок и упражнениями', '• The reply is a video with your mistakes explained and drills', '• La respuesta es un video con tus errores y ejercicios', '• A resposta é um vídeo com seus erros e exercícios', '• La réponse est une vidéo avec tes erreurs et des exercices', '• Die Antwort ist ein Video mit deinen Fehlern und Übungen', '• 返信はミスの解説と練習メニューの動画です', '• 답변은 실수 분석과 연습법이 담긴 영상이에요', '• 回复是讲解问题并附练习的视频')
t('• Один уточняющий вопрос после разбора — бесплатно', '• One follow-up question after the review — free', '• Una pregunta extra después de la revisión — gratis', '• Uma pergunta extra depois da análise — grátis', '• Une question de suivi après l’analyse — gratuite', '• Eine Rückfrage nach dem Feedback — kostenlos', '• 添削後の質問1回は無料', '• 피드백 후 추가 질문 1회 무료', '• 点评后追问一次 — 免费')
t('Стоимость', 'Price', 'Precio', 'Preço', 'Prix', 'Preis', '料金', '가격', '价格')
t('или', 'or', 'o', 'ou', 'ou', 'oder', 'または', '또는', '或')
t('Написать в Telegram', 'Message on Telegram', 'Escribir por Telegram', 'Mandar mensagem no Telegram', 'Écrire sur Telegram', 'Auf Telegram schreiben', 'Telegramでメッセージ', '텔레그램으로 메시지', '在 Telegram 上联系')
t('Сообщение уже будет написано — останется нажать «Отправить».', 'The message will already be written — just tap “Send”.', 'El mensaje ya estará escrito — solo toca «Enviar».', 'A mensagem já vai estar escrita — é só tocar em “Enviar”.', 'Le message sera déjà écrit — il suffira d’appuyer sur « Envoyer ».', 'Die Nachricht ist schon geschrieben — du musst nur auf „Senden“ tippen.', 'メッセージは入力済み。「送信」を押すだけです。', '메시지는 이미 작성되어 있어요. “보내기”만 누르면 돼요.', '消息已经写好，只需点“发送”。')
t('Привет! Я на разбор из приложения Fedoskin team 🔥', 'Hi! I want a review — I found you in the Fedoskin team app 🔥', '¡Hola! Quiero una revisión — vengo de la app Fedoskin team 🔥', 'Oi! Quero uma análise — vim pelo app Fedoskin team 🔥', 'Salut ! Je veux une analyse — je viens de l’app Fedoskin team 🔥', 'Hi! Ich möchte ein Feedback — ich komme aus der Fedoskin team App 🔥', 'こんにちは！Fedoskin teamアプリから添削をお願いしたいです 🔥', '안녕하세요! Fedoskin team 앱에서 피드백 신청하러 왔어요 🔥', '你好！我从 Fedoskin team 应用来，想申请点评 🔥')
t('Формат:', 'Format:', 'Formato:', 'Formato:', 'Format :', 'Format:', '形式：', '형식:', '形式：')
t('Сейчас пришлю видео.', 'Sending the video now.', 'Ahora te envío el video.', 'Já vou mandar o vídeo.', 'J’envoie la vidéo tout de suite.', 'Ich schicke gleich das Video.', 'これから動画を送ります。', '지금 영상 보낼게요.', '马上发视频。')

# ---- profile ----
t('Сменить аватар', 'Change avatar', 'Cambiar avatar', 'Trocar avatar', 'Changer d’avatar', 'Avatar ändern', 'アバターを変更', '아바타 변경', '更换头像')
t('Изменить имя, страну и город', 'Edit name, country and city', 'Editar nombre, país y ciudad', 'Editar nome, país e cidade', 'Modifier le nom, le pays et la ville', 'Name, Land und Stadt ändern', '名前・国・都市を編集', '이름, 국가, 도시 수정', '修改名字、国家和城市')
t('α АЛЬФА-ТЕСТЕР', 'α ALPHA TESTER', 'α ALFA TESTER', 'α ALFA TESTER', 'α ALPHA-TESTEUR', 'α ALPHA-TESTER', 'α アルファテスター', 'α 알파 테스터', 'α 内测用户')
t('ID аккаунта:', 'Account ID:', 'ID de cuenta:', 'ID da conta:', 'ID du compte :', 'Konto-ID:', 'アカウントID：', '계정 ID:', '账号 ID：')
t('Ты альфа-тестер. Когда приложение станет платным, получишь месяц подписки бесплатно, а значок и аватар «Альфа» останутся у тебя навсегда.',
  'You are an alpha tester. When the app becomes paid, you get one month of subscription for free, and the “Alpha” badge and avatar stay with you forever.',
  'Eres alfa tester. Cuando la app sea de pago, tendrás un mes de suscripción gratis, y la insignia y el avatar «Alfa» serán tuyos para siempre.',
  'Você é alfa tester. Quando o app ficar pago, você ganha um mês de assinatura grátis, e o selo e o avatar “Alfa” ficam com você para sempre.',
  'Tu es alpha-testeur. Quand l’app deviendra payante, tu auras un mois d’abonnement offert, et le badge et l’avatar « Alpha » resteront à toi pour toujours.',
  'Du bist Alpha-Tester. Wenn die App kostenpflichtig wird, bekommst du einen Monat Abo gratis, und das „Alpha“-Abzeichen und der Avatar bleiben für immer bei dir.',
  'あなたはアルファテスターです。アプリが有料になったら1か月分のサブスクが無料になり、「アルファ」バッジとアバターはずっとあなたのものです。',
  '당신은 알파 테스터예요. 앱이 유료가 되면 구독 1개월이 무료이고, “알파” 배지와 아바타는 영원히 당신 것입니다.',
  '你是内测用户。应用开始收费后，你将免费获得一个月订阅，“Alpha”徽章和头像永久归你。')
t('Твой уровень', 'Your level', 'Tu nivel', 'Seu nível', 'Ton niveau', 'Dein Level', 'あなたのレベル', '내 레벨', '你的等级')
t('Уровень {n}', 'Level {n}', 'Nivel {n}', 'Nível {n}', 'Niveau {n}', 'Level {n}', 'レベル {n}', '레벨 {n}', '等级 {n}')
t('Уровень 1', 'Level 1', 'Nivel 1', 'Nível 1', 'Niveau 1', 'Level 1', 'レベル 1', '레벨 1', '等级 1')
t('Ещё {n} мин. тренировок до уровня {next}', '{n} more training minutes to level {next}', '{n} min más de entrenamiento para el nivel {next}', 'Mais {n} min de treino até o nível {next}', 'Encore {n} min d’entraînement jusqu’au niveau {next}', 'Noch {n} Min. Training bis Level {next}', 'レベル {next} まであと練習 {n} 分', '레벨 {next}까지 연습 {n}분 남음', '再练 {n} 分钟升到等级 {next}')
t('Максимальный уровень — ты легенда', 'Max level — you are a legend', 'Nivel máximo — eres una leyenda', 'Nível máximo — você é uma lenda', 'Niveau max — tu es une légende', 'Max-Level — du bist eine Legende', '最高レベル — あなたはレジェンド', '최고 레벨 — 당신은 레전드', '最高等级 — 你是传奇')
t('роликов посмотрено', 'videos watched', 'videos vistos', 'vídeos assistidos', 'vidéos vues', 'Videos angesehen', '視聴した動画', '본 영상', '已看视频')
t('минут тренировок', 'training minutes', 'minutos de entrenamiento', 'minutos de treino', 'minutes d’entraînement', 'Trainingsminuten', '練習時間（分）', '연습 시간(분)', '训练分钟')
t('дней подряд', 'days in a row', 'días seguidos', 'dias seguidos', 'jours d’affilée', 'Tage in Folge', '連続日数', '연속 일수', '连续天数')
t('Считаются уроки и минуты, которые ты реально смотришь. Статистика хранится на этом телефоне.', 'Only lessons and minutes you actually watch count. Your stats are stored on this phone.', 'Solo cuentan las lecciones y minutos que de verdad ves. Tus estadísticas se guardan en este teléfono.', 'Só contam as aulas e minutos que você realmente assiste. Suas estatísticas ficam salvas neste celular.', 'Seules les leçons et minutes vraiment regardées comptent. Tes stats sont stockées sur ce téléphone.', 'Es zählen nur Lektionen und Minuten, die du wirklich ansiehst. Deine Statistik wird auf diesem Handy gespeichert.', '実際に見たレッスンと時間だけがカウントされます。記録はこのスマホに保存されます。', '실제로 본 레슨과 시간만 집계돼요. 기록은 이 휴대폰에 저장됩니다.', '只统计你真正看过的课程和分钟数。数据保存在这部手机上。')
t('Рейтинг', 'Ranking', 'Ranking', 'Ranking', 'Classement', 'Rangliste', 'ランキング', '랭킹', '排行榜')
t('Общий рейтинг с другими брейкерами появится вместе с аккаунтами. А пока набирай минуты и делись своей статистикой в сторис.',
  'A shared ranking with other breakers will come together with accounts. For now, rack up minutes and share your stats in your stories.',
  'El ranking con otros breakers llegará junto con las cuentas. Mientras tanto, suma minutos y comparte tus estadísticas en tus historias.',
  'O ranking com outros breakers vai chegar junto com as contas. Por enquanto, acumule minutos e compartilhe suas estatísticas nos stories.',
  'Le classement avec les autres breakers arrivera avec les comptes. En attendant, accumule des minutes et partage tes stats en story.',
  'Eine gemeinsame Rangliste mit anderen Breakern kommt zusammen mit den Konten. Bis dahin: sammle Minuten und teile deine Statistik in deiner Story.',
  '他のブレイカーとのランキングはアカウント機能と一緒に登場します。それまでは練習時間を積み上げて、記録をストーリーでシェアしよう。',
  '다른 브레이커들과의 랭킹은 계정 기능과 함께 나와요. 그동안 연습 시간을 쌓고 기록을 스토리에 공유해 보세요.',
  '和其他 breaker 的排行榜会和账号功能一起上线。现在先攒训练时长，把你的数据分享到快拍吧。')
t('Поделиться статистикой', 'Share my stats', 'Compartir estadísticas', 'Compartilhar estatísticas', 'Partager mes stats', 'Statistik teilen', '記録をシェア', '기록 공유', '分享我的数据')
t('Прогресс по разделам', 'Progress by section', 'Progreso por sección', 'Progresso por seção', 'Progression par section', 'Fortschritt nach Bereich', 'カテゴリー別の進み具合', '카테고리별 진행도', '各分类进度')
t('{done} из {total}', '{done} of {total}', '{done} de {total}', '{done} de {total}', '{done} sur {total}', '{done} von {total}', '{done}/{total}', '{done}/{total}', '{done}/{total}')
t('Мои разборы', 'My reviews', 'Mis revisiones', 'Minhas análises', 'Mes analyses', 'Mein Feedback', '自分の添削', '내 피드백', '我的点评')
t('Доступ', 'Access', 'Acceso', 'Acesso', 'Accès', 'Zugang', 'アクセス', '이용 권한', '权限')
t('Бесплатно · альфа-тест', 'Free · alpha test', 'Gratis · prueba alfa', 'Grátis · teste alfa', 'Gratuit · alpha', 'Kostenlos · Alpha-Test', '無料 · アルファテスト', '무료 · 알파 테스트', '免费 · 内测')
t('Во время альфа-теста все уроки бесплатны', 'All lessons are free during the alpha test', 'Todas las lecciones son gratis durante la prueba alfa', 'Todas as aulas são grátis durante o teste alfa', "Toutes les leçons sont gratuites pendant l'alpha", 'Während des Alpha-Tests sind alle Lektionen kostenlos', 'アルファテスト中は全レッスン無料です', '알파 테스트 기간에는 모든 레슨이 무료예요', '内测期间所有课程免费')
t('Установить на телефон', 'Install on your phone', 'Instalar en el teléfono', 'Instalar no celular', 'Installer sur le téléphone', 'Aufs Handy installieren', 'スマホにインストール', '휴대폰에 설치', '安装到手机')
t('иконка на экране', 'home screen icon', 'icono en la pantalla', 'ícone na tela', 'icône sur l’écran', 'Icon auf dem Bildschirm', 'ホーム画面にアイコン', '홈 화면 아이콘', '桌面图标')
t('Добавь ник', 'Add a nickname', 'Añade un apodo', 'Adicione um apelido', 'Ajoute un pseudo', 'Nickname hinzufügen', 'ニックネームを追加', '닉네임 추가', '添加昵称')
t('Город и страна не указаны', 'City and country not set', 'Ciudad y país sin indicar', 'Cidade e país não informados', 'Ville et pays non renseignés', 'Stadt und Land nicht angegeben', '都市と国が未設定', '도시와 국가 미설정', '未填写城市和国家')
t('Профиль сохранён', 'Profile saved', 'Perfil guardado', 'Perfil salvo', 'Profil enregistré', 'Profil gespeichert', 'プロフィールを保存しました', '프로필 저장됨', '资料已保存')
t('Твой профиль', 'Your profile', 'Tu perfil', 'Seu perfil', 'Ton profil', 'Dein Profil', 'プロフィール', '내 프로필', '个人资料')
t('Имя (никнейм)', 'Name (nickname)', 'Nombre (apodo)', 'Nome (apelido)', 'Nom (pseudo)', 'Name (Nickname)', '名前（ニックネーム）', '이름(닉네임)', '名字（昵称）')
t('Страна', 'Country', 'País', 'País', 'Pays', 'Land', '国', '국가', '国家')
t('Город', 'City', 'Ciudad', 'Cidade', 'Ville', 'Stadt', '都市', '도시', '城市')
t('Например, B-boy Storm', 'e.g. B-boy Storm', 'p. ej. B-boy Storm', 'ex.: B-boy Storm', 'ex. : B-boy Storm', 'z. B. B-boy Storm', '例：B-boy Storm', '예: B-boy Storm', '例如 B-boy Storm')
t('Например, Россия', 'e.g. USA', 'p. ej. España', 'ex.: Brasil', 'ex. : France', 'z. B. Deutschland', '例：日本', '예: 대한민국', '例如 中国')
t('Где ты тренируешься', 'Where you train', 'Dónde entrenas', 'Onde você treina', 'Où tu t’entraînes', 'Wo du trainierst', '練習している場所', '연습하는 곳', '你在哪里训练')
t('Выбери аватар', 'Choose an avatar', 'Elige un avatar', 'Escolha um avatar', 'Choisis un avatar', 'Wähle einen Avatar', 'アバターを選ぶ', '아바타 선택', '选择头像')
t('Аватар видят другие в рейтинге. «α» — только для альфа-тестеров.', 'Others see your avatar in the ranking. “α” is for alpha testers only.', 'Los demás ven tu avatar en el ranking. «α» es solo para alfa testers.', 'Os outros veem seu avatar no ranking. “α” é só para alfa testers.', 'Les autres voient ton avatar dans le classement. « α » est réservé aux alpha-testeurs.', 'Andere sehen deinen Avatar in der Rangliste. „α“ gibt es nur für Alpha-Tester.', 'アバターはランキングで他の人に表示されます。「α」はアルファテスター限定です。', '아바타는 랭킹에서 다른 사람에게 보여요. “α”는 알파 테스터 전용이에요.', '头像会在排行榜中展示给别人。“α”仅限内测用户。')
t('Аватары', 'Avatars', 'Avatares', 'Avatares', 'Avatars', 'Avatare', 'アバター', '아바타', '头像')
t('Аватар Альфа, только для альфа-тестеров', 'Alpha avatar, alpha testers only', 'Avatar Alfa, solo para alfa testers', 'Avatar Alfa, só para alfa testers', 'Avatar Alpha, réservé aux alpha-testeurs', 'Alpha-Avatar, nur für Alpha-Tester', 'アルファアバター（テスター限定）', '알파 아바타, 알파 테스터 전용', 'Alpha 头像，仅限内测用户')
t('Аватар {id}', 'Avatar {id}', 'Avatar {id}', 'Avatar {id}', 'Avatar {id}', 'Avatar {id}', 'アバター {id}', '아바타 {id}', '头像 {id}')
t('Аватар обновлён', 'Avatar updated', 'Avatar actualizado', 'Avatar atualizado', 'Avatar mis à jour', 'Avatar aktualisiert', 'アバターを変更しました', '아바타가 변경됐어요', '头像已更新')
t('Альфа-тестер', 'Alpha tester', 'Alfa tester', 'Alfa tester', 'Alpha-testeur', 'Alpha-Tester', 'アルファテスター', '알파 테스터', '内测用户')

# ---- story card ----
t('Карточка для сторис', 'Story card', 'Tarjeta para historias', 'Card para stories', 'Carte pour la story', 'Story-Karte', 'ストーリー用カード', '스토리 카드', '快拍卡片')
t('минут тренировок в Fedoskin', 'training minutes in Fedoskin', 'minutos de entrenamiento en Fedoskin', 'minutos de treino no Fedoskin', 'minutes d’entraînement sur Fedoskin', 'Trainingsminuten in Fedoskin', 'Fedoskinでの練習時間（分）', 'Fedoskin 연습 시간(분)', '在 Fedoskin 训练的分钟数')
t('минута тренировок в Fedoskin', 'training minute in Fedoskin', 'minuto de entrenamiento en Fedoskin', 'minuto de treino no Fedoskin', 'minute d’entraînement sur Fedoskin', 'Trainingsminute in Fedoskin', 'Fedoskinでの練習時間（分）', 'Fedoskin 연습 시간(분)', '在 Fedoskin 训练的分钟数')
t('уровень', 'level', 'nivel', 'nível', 'niveau', 'Level', 'レベル', '레벨', '等级')
t('роликов', 'videos', 'videos', 'vídeos', 'vidéos', 'Videos', '動画', '영상', '视频')
t('Сможешь выше? · Fedoskin team app', 'Can you beat it? · Fedoskin team app', '¿Puedes superarlo? · Fedoskin team app', 'Consegue passar? · Fedoskin team app', 'Tu peux faire mieux ? · Fedoskin team app', 'Schaffst du mehr? · Fedoskin team app', '超えられる？ · Fedoskin team app', '이길 수 있어? · Fedoskin team app', '你能超过吗？ · Fedoskin team app')
t('Поделиться в сторис', 'Share to story', 'Compartir en historias', 'Compartilhar nos stories', 'Partager en story', 'In Story teilen', 'ストーリーでシェア', '스토리에 공유', '分享到快拍')
t('Брейкер', 'Breaker', 'Breaker', 'Breaker', 'Breaker', 'Breaker', 'ブレイカー', '브레이커', 'Breaker')
t('В приложении откроется Instagram со сторис', 'Instagram stories will open here', 'Aquí se abrirán las historias de Instagram', 'Aqui vão abrir os stories do Instagram', 'Les stories Instagram s’ouvriront ici', 'Hier öffnen sich die Instagram-Stories', 'ここでInstagramのストーリーが開きます', '여기서 인스타그램 스토리가 열려요', '这里会打开 Instagram 快拍')

# ---- install guide ----
t('Добавь Fedoskin на экран', 'Add Fedoskin to your home screen', 'Añade Fedoskin a tu pantalla', 'Adicione o Fedoskin à tela', 'Ajoute Fedoskin à ton écran', 'Fedoskin zum Startbildschirm hinzufügen', 'Fedoskinをホーム画面に追加', 'Fedoskin을 홈 화면에 추가', '把 Fedoskin 添加到桌面')
t('Будет открываться как приложение — на весь экран, одним нажатием', 'It opens like an app — full screen, in one tap', 'Se abrirá como una app — a pantalla completa, con un toque', 'Abre como um app — em tela cheia, com um toque', 'Elle s’ouvrira comme une app — en plein écran, en un geste', 'Öffnet sich wie eine App — im Vollbild, mit einem Tipp', 'アプリのように全画面でワンタップで開けます', '앱처럼 전체 화면으로 한 번에 열려요', '像应用一样一键全屏打开')
t('Установить', 'Install', 'Instalar', 'Instalar', 'Installer', 'Installieren', 'インストール', '설치', '安装')
t('Fedoskin добавлен на экран', 'Fedoskin added to your home screen', 'Fedoskin añadido a tu pantalla', 'Fedoskin adicionado à tela', 'Fedoskin ajouté à ton écran', 'Fedoskin zum Startbildschirm hinzugefügt', 'Fedoskinをホーム画面に追加しました', 'Fedoskin이 홈 화면에 추가됐어요', 'Fedoskin 已添加到桌面')
t('Приложение уже на экране телефона', 'The app is already on your home screen', 'La app ya está en tu pantalla', 'O app já está na sua tela', 'L’app est déjà sur ton écran', 'Die App ist schon auf deinem Startbildschirm', 'アプリはすでにホーム画面にあります', '앱이 이미 홈 화면에 있어요', '应用已经在桌面上了')
t('Ты открыл ссылку внутри Instagram или другого приложения — оттуда иконку не добавить',
  'You opened the link inside Instagram or another app — you can’t add the icon from there',
  'Abriste el enlace dentro de Instagram u otra app — desde ahí no se puede añadir el icono',
  'Você abriu o link dentro do Instagram ou de outro app — de lá não dá para adicionar o ícone',
  'Tu as ouvert le lien dans Instagram ou une autre app — impossible d’ajouter l’icône depuis là',
  'Du hast den Link in Instagram oder einer anderen App geöffnet — von dort lässt sich das Icon nicht hinzufügen',
  'Instagramなど他のアプリ内でリンクを開いています。そこからはアイコンを追加できません',
  '인스타그램 등 다른 앱 안에서 링크를 열었어요. 거기서는 아이콘을 추가할 수 없어요',
  '你是在 Instagram 或其他应用里打开的链接，在那里无法添加图标')
t('Нажми {k1} или {k2} в углу экрана', 'Tap {k1} or {k2} in the corner of the screen', 'Toca {k1} o {k2} en la esquina de la pantalla', 'Toque em {k1} ou {k2} no canto da tela', 'Appuie sur {k1} ou {k2} dans le coin de l’écran', 'Tippe auf {k1} oder {k2} in der Bildschirmecke', '画面の隅の {k1} または {k2} をタップ', '화면 모서리의 {k1} 또는 {k2}를 누르세요', '点屏幕角落的 {k1} 或 {k2}')
t('Выбери {k} — и повтори добавление уже там', 'Choose {k} — and add it from there', 'Elige {k} — y añádelo desde ahí', 'Escolha {k} — e adicione por lá', 'Choisis {k} — et refais l’ajout depuis là', 'Wähle {k} — und füge es dort hinzu', '{k} を選び、そこでもう一度追加してください', '{k}을 선택하고 거기서 다시 추가하세요', '选择 {k}，然后在浏览器里重新添加')
t('Открыть в браузере', 'Open in browser', 'Abrir en el navegador', 'Abrir no navegador', 'Ouvrir dans le navigateur', 'Im Browser öffnen', 'ブラウザで開く', '브라우저에서 열기', '在浏览器中打开')
t('Открой эту ссылку в {k}', 'Open this link in {k}', 'Abre este enlace en {k}', 'Abra este link no {k}', 'Ouvre ce lien dans {k}', 'Öffne diesen Link in {k}', 'このリンクを {k} で開く', '이 링크를 {k}에서 여세요', '用 {k} 打开这个链接')
t('Нажми {k} внизу экрана', 'Tap {k} at the bottom of the screen', 'Toca {k} abajo en la pantalla', 'Toque em {k} na parte de baixo da tela', 'Appuie sur {k} en bas de l’écran', 'Tippe unten auf {k}', '画面下の {k} をタップ', '화면 아래의 {k}를 누르세요', '点屏幕底部的 {k}')
t('Поделиться', 'Share', 'Compartir', 'Compartilhar', 'Partager', 'Teilen', '共有', '공유', '分享')
t('Пролистай вниз и выбери {k}', 'Scroll down and choose {k}', 'Desliza hacia abajo y elige {k}', 'Role para baixo e escolha {k}', 'Fais défiler et choisis {k}', 'Scroll nach unten und wähle {k}', '下にスクロールして {k} を選ぶ', '아래로 내려서 {k}를 선택하세요', '往下滑，选择 {k}')
t('На экран «Домой»', 'Add to Home Screen', 'Añadir a pantalla de inicio', 'Adicionar à Tela de Início', 'Sur l’écran d’accueil', 'Zum Home-Bildschirm', 'ホーム画面に追加', '홈 화면에 추가', '添加到主屏幕')
t('Нажми {k} в правом верхнем углу', 'Tap {k} in the top right corner', 'Toca {k} arriba a la derecha', 'Toque em {k} no canto superior direito', 'Appuie sur {k} en haut à droite', 'Tippe oben rechts auf {k}', '右上の {k} をタップ', '오른쪽 위의 {k}를 누르세요', '点右上角的 {k}')
t('Добавить', 'Add', 'Añadir', 'Adicionar', 'Ajouter', 'Hinzufügen', '追加', '추가', '添加')
t('Выбери {k1} или {k2}', 'Choose {k1} or {k2}', 'Elige {k1} o {k2}', 'Escolha {k1} ou {k2}', 'Choisis {k1} ou {k2}', 'Wähle {k1} oder {k2}', '{k1} または {k2} を選ぶ', '{k1} 또는 {k2}를 선택하세요', '选择 {k1} 或 {k2}')
t('Добавить на главный экран', 'Add to Home screen', 'Añadir a la pantalla de inicio', 'Adicionar à tela inicial', 'Ajouter à l’écran d’accueil', 'Zum Startbildschirm hinzufügen', 'ホーム画面に追加', '홈 화면에 추가', '添加到主屏幕')
t('Установить приложение', 'Install app', 'Instalar app', 'Instalar app', 'Installer l’application', 'App installieren', 'アプリをインストール', '앱 설치', '安装应用')
t('Подтверди — нажми {k}', 'Confirm — tap {k}', 'Confirma — toca {k}', 'Confirme — toque em {k}', 'Confirme — appuie sur {k}', 'Bestätige — tippe auf {k}', '{k} をタップして確定', '{k}를 눌러 확인하세요', '点 {k} 确认')
t('Открой эту ссылку на телефоне', 'Open this link on your phone', 'Abre este enlace en tu teléfono', 'Abra este link no seu celular', 'Ouvre ce lien sur ton téléphone', 'Öffne diesen Link auf deinem Handy', 'このリンクをスマホで開いてください', '이 링크를 휴대폰에서 여세요', '在手机上打开这个链接')
t('Код скопирован', 'Code copied', 'Código copiado', 'Código copiado', 'Code copié', 'Code kopiert', 'コードをコピーしました', '코드 복사됨', '已复制代码')
t('Выдели код и скопируй вручную', 'Select the code and copy it manually', 'Selecciona el código y cópialo a mano', 'Selecione o código e copie manualmente', 'Sélectionne le code et copie-le à la main', 'Markiere den Code und kopiere ihn selbst', 'コードを選択して手動でコピーしてください', '코드를 선택해 직접 복사하세요', '请选中代码手动复制')
t('Выбери язык', 'Choose language', 'Elige idioma', 'Escolha o idioma', 'Choisis la langue', 'Sprache wählen', '言語を選ぶ', '언어 선택', '选择语言')
t('Видео уроков — на русском языке. Названия элементов — международные.', 'Lesson videos are in Russian. Move names are international.', 'Los videos de las lecciones están en ruso. Los nombres de los pasos son internacionales.', 'Os vídeos das aulas são em russo. Os nomes dos passos são internacionais.', 'Les vidéos des leçons sont en russe. Les noms des moves sont internationaux.', 'Die Lektionsvideos sind auf Russisch. Die Namen der Moves sind international.', 'レッスン動画はロシア語です。技の名前は世界共通です。', '레슨 영상은 러시아어예요. 기술 이름은 국제 공통이에요.', '课程视频为俄语讲解，动作名称是国际通用的。')

# ---- push notifications ----
t('Сообщать о новых уроках?', 'Get notified about new lessons?', '¿Te avisamos de lecciones nuevas?', 'Quer aviso de aulas novas?', 'Être prévenu des nouvelles leçons ?', 'Über neue Lektionen informieren?', '新しいレッスンを通知しますか？', '새 레슨 알림을 받을까요?', '有新课程时通知你？')
t('Пришлём уведомление, когда в приложении появится новый элемент.', 'We’ll send a notification when a new move is added to the app.', 'Te enviaremos una notificación cuando haya un paso nuevo en la app.', 'Vamos enviar uma notificação quando um passo novo entrar no app.', 'On t’enverra une notification quand un nouveau move arrive dans l’app.', 'Wir schicken dir eine Benachrichtigung, wenn ein neuer Move in der App ist.', '新しい技が追加されたら通知でお知らせします。', '새 기술이 추가되면 알림을 보내 드려요.', '应用里有新动作时，我们会通知你。')
t('Включить', 'Turn on', 'Activar', 'Ativar', 'Activer', 'Einschalten', 'オンにする', '켜기', '开启')
t('Не сейчас', 'Not now', 'Ahora no', 'Agora não', 'Pas maintenant', 'Nicht jetzt', '今はしない', '나중에', '暂不')
t('Уведомления о новых уроках', 'New lesson notifications', 'Avisos de lecciones nuevas', 'Avisos de aulas novas', 'Notifications des nouvelles leçons', 'Benachrichtigungen zu neuen Lektionen', '新しいレッスンの通知', '새 레슨 알림', '新课程通知')
t('Включены', 'On', 'Activados', 'Ativados', 'Activées', 'An', 'オン', '켜짐', '已开启')
t('Выключены', 'Off', 'Desactivados', 'Desativados', 'Désactivées', 'Aus', 'オフ', '꺼짐', '已关闭')
t('Сначала добавь на экран', 'Add to home screen first', 'Primero añádela a la pantalla', 'Primeiro adicione à tela', 'Ajoute d’abord à l’écran', 'Erst zum Startbildschirm hinzufügen', '先にホーム画面に追加', '먼저 홈 화면에 추가', '请先添加到桌面')
t('Не поддерживается', 'Not supported', 'No compatible', 'Não suportado', 'Non pris en charge', 'Nicht unterstützt', '非対応', '지원되지 않음', '不支持')
t('Запрещены в настройках', 'Blocked in settings', 'Bloqueados en ajustes', 'Bloqueados nas configurações', 'Bloquées dans les réglages', 'In den Einstellungen blockiert', '設定でブロック中', '설정에서 차단됨', '已在设置中禁止')
t('Уведомления запрещены — включи их в настройках телефона', 'Notifications are blocked — turn them on in your phone settings', 'Las notificaciones están bloqueadas — actívalas en los ajustes del teléfono', 'As notificações estão bloqueadas — ative nas configurações do celular', 'Les notifications sont bloquées — active-les dans les réglages du téléphone', 'Benachrichtigungen sind blockiert — schalte sie in den Handy-Einstellungen ein', '通知がブロックされています。スマホの設定でオンにしてください', '알림이 차단되어 있어요. 휴대폰 설정에서 켜 주세요', '通知已被禁止 — 请在手机设置中开启')
t('Готово — сообщим о новых уроках', 'Done — we’ll let you know about new lessons', 'Listo — te avisaremos de lecciones nuevas', 'Pronto — vamos avisar sobre aulas novas', 'C’est fait — on te préviendra des nouvelles leçons', 'Fertig — wir melden uns bei neuen Lektionen', '完了 — 新しいレッスンをお知らせします', '완료 — 새 레슨을 알려 드릴게요', '好了 — 有新课程会通知你')
t('Не получилось включить уведомления, попробуй позже', 'Couldn’t turn on notifications, try again later', 'No se pudieron activar los avisos, inténtalo más tarde', 'Não deu para ativar os avisos, tente mais tarde', 'Impossible d’activer les notifications, réessaie plus tard', 'Benachrichtigungen konnten nicht eingeschaltet werden, versuch es später', '通知をオンにできませんでした。あとでもう一度試してください', '알림을 켜지 못했어요. 나중에 다시 시도해 주세요', '无法开启通知，请稍后再试')
t('Уведомления выключены', 'Notifications turned off', 'Avisos desactivados', 'Avisos desativados', 'Notifications désactivées', 'Benachrichtigungen ausgeschaltet', '通知をオフにしました', '알림이 꺼졌어요', '通知已关闭')
t('Этот браузер не умеет показывать уведомления', 'This browser can’t show notifications', 'Este navegador no puede mostrar notificaciones', 'Este navegador não mostra notificações', 'Ce navigateur ne peut pas afficher de notifications', 'Dieser Browser kann keine Benachrichtigungen anzeigen', 'このブラウザは通知に対応していません', '이 브라우저는 알림을 지원하지 않아요', '此浏览器无法显示通知')
t('Новый урок появится через пару минут — потяни экран вниз, чтобы обновить', 'The new lesson will appear in a couple of minutes — pull down to refresh', 'La lección nueva aparecerá en un par de minutos — desliza hacia abajo para actualizar', 'A aula nova aparece em alguns minutos — puxe a tela para baixo para atualizar', 'La nouvelle leçon arrive dans quelques minutes — tire l’écran vers le bas pour actualiser', 'Die neue Lektion erscheint in ein paar Minuten — zum Aktualisieren nach unten ziehen', '新しいレッスンは数分で表示されます。下に引っぱって更新してください', '새 레슨은 몇 분 뒤에 나타나요. 아래로 당겨 새로고침하세요', '新课程几分钟后出现 — 下拉刷新')

# ---- online services tab (long texts live in their own file) ----
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from i18n_services import ROWS as _SVC
for _r in _SVC: t(*_r)

LANGS = [['ru', 'Русский'], ['en', 'English'], ['es', 'Español'], ['pt', 'Português'], ['fr', 'Français'], ['de', 'Deutsch'], ['ja', '日本語'], ['ko', '한국어'], ['zh', '中文']]

import json
dicts = {l: {k: v[l] for k, v in D.items()} for l in L}
out = ('// Переводы интерфейса приложения. Ключ — русский текст, значение — перевод.\n'
       '// Языки: ' + ', '.join(n for _, n in LANGS) + '\n'
       'window.I18N = {\n "langs": ' + json.dumps(LANGS, ensure_ascii=False) + ',\n'
       + ',\n'.join(' ' + json.dumps(l) + ': ' + json.dumps(dicts[l], ensure_ascii=False, indent=0).replace('\n', '\n ') for l in L)
       + '\n};\n')
import sys
open(sys.argv[1], 'w', encoding='utf-8').write(out)
print(len(D), 'keys')
