// Мгновенный старт уроков из Kinescope. Его меняет админка (admin.html) — формат JSON.
// урок → id видео Kinescope, из которого вырезано начало v/<урок>-intro.mp4 (первые 5 сек, те же кадры, что в потоке).
// Если видео урока в Kinescope заменили, id не совпадёт — приложение просто не будет использовать старое начало.
window.LESSON_INTROS = {
 "fw-6step": "a4e77791-70b3-458b-b62d-fb48d60dbc50",
 "gd-windmill-entry": "23993e1d-9e0f-4e07-9ac9-de62a0cfabad",
 "fr-easychair": "5d85dd25-d0a6-4429-b038-a828c8eb2f07",
 "fr-elbow": "612865e9-a251-428a-a7b7-221ed67d3f9f",
 "tk-monkey": "8eb7c39d-271c-40ac-bcfe-f0558e8e30ad",
 "tk-turtlehs": "5a15190c-6108-414f-bbe0-73987bd64906",
 "pw-airflare": "de8dad97-f470-4552-93c4-45575e6d3f29",
 "pw-turtle": "634db7c3-35bc-4a80-b160-c44a09cdbab8",
 "pw-windmill": "8b3ef664-01b9-42db-a1e1-b88ad726c46c",
 "pw-swipes": "6ee9d371-0eb2-4221-8f98-35a9c985c3ba",
 "pw-headspin": "8a2e472e-d16f-4c45-9032-b4781ba7d840",
 "pw-munchmill": "dfb81103-2a48-4752-938a-b851625ae79f",
 "tr-windmill-head": "8da3c6ff-6f53-41ab-9f02-755358e3e5df",
 "tn-flare-to-airflare-to-flare": "262fa2a3-9675-40ac-8b20-5092475a3192",
 "pw-flare-wm": "fcbcbb79-43ca-482d-b0f2-01472155230a",
 "pw-flare-1990": "9646f680-1ae0-4b57-99f3-d1b8ea41cb7f",
 "pw-swipes-flare": "6faac4e1-de8a-4952-8d09-6134e13ee34a"
};
