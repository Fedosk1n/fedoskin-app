// Мгновенный старт уроков из Kinescope. Его меняет админка (admin.html) — формат JSON.
// урок → "id видео Kinescope:480" — из какого видео и какого качества вырезано начало v/<урок>-intro.mp4 (первые 5 сек, те же кадры, что в потоке).
// Если видео урока в Kinescope заменили, id не совпадёт — приложение просто не будет использовать старое начало.
window.LESSON_INTROS = {
 "gd-windmill-entry": "23993e1d-9e0f-4e07-9ac9-de62a0cfabad:480",
 "pw-airflare": "de8dad97-f470-4552-93c4-45575e6d3f29:480",
 "pw-turtle": "634db7c3-35bc-4a80-b160-c44a09cdbab8:480",
 "pw-windmill": "8b3ef664-01b9-42db-a1e1-b88ad726c46c:480",
 "pw-swipes": "6ee9d371-0eb2-4221-8f98-35a9c985c3ba:480",
 "pw-headspin": "8a2e472e-d16f-4c45-9032-b4781ba7d840:480",
 "pw-munchmill": "dfb81103-2a48-4752-938a-b851625ae79f:480",
 "tr-windmill-head": "8da3c6ff-6f53-41ab-9f02-755358e3e5df:480",
 "tn-flare-to-airflare-to-flare": "262fa2a3-9675-40ac-8b20-5092475a3192:480",
 "pw-flare-wm": "fcbcbb79-43ca-482d-b0f2-01472155230a:480",
 "pw-flare-1990": "9646f680-1ae0-4b57-99f3-d1b8ea41cb7f:480",
 "pw-swipes-flare": "6faac4e1-de8a-4952-8d09-6134e13ee34a:480"
};
