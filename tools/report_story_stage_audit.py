"""Merge the pure and browser storyline audits into an owner-facing UTF-8 CSV."""
import argparse
import csv
import json
from pathlib import Path

DISTRICTS = {'yard': 'Двор', 'center': 'Центр', 'park': 'Парк', 'prom': 'Промзона', 'club': 'Клуб'}
LOCATIONS = {
    'show': 'круг сайфера', 'dj': 'пульт Винта', 'mat': 'тренировочный коврик',
    'powerContest': 'пауэрмув-контест', 'mall': 'площадка у ТЦ «Круг»', 'tea': 'чайный киоск',
    'metro': 'метро', 'jam': 'эстрада', 'bars': 'турники', 'og': 'шахматные столы',
    'ring': 'ринг', 'zpark': 'арка со стороны Парка', 'smoke': 'танцпол',
    'clubDJ': 'клубный пульт', 'clubRecords': 'стена результатов',
}
PREP = {
    'circle': 'круг сайфера', 'mat': 'тренировочный коврик', 'tea': 'чайный киоск',
    'chess': 'шахматные столы', 'loading': 'арка со стороны Парка',
    'wall': 'стена результатов', 'club': 'танцпол', 'ring': 'ринг', 'metro': 'метро',
}
PROLOGUE = (
    ('Винт', 'Двор · круг', 'Смотреть круг 8 секунд'),
    ('Трафареты', 'Центр · ТЦ', 'Станцевать шоу у ТЦ'),
    ('Шуруп', 'Парк · эстрада', 'Выиграть первый раунд джема'),
    ('Клёпка', 'Промзона · ринг', 'Выиграть батл на ринге'),
    ('Винт, Трафареты, Шуруп, Клёпка', 'Двор · круг', 'Посмотреть три раунда и завершить общий сайфер'),
)
DECISIONS = {'slot': 'Кому дать последний раунд', 'venue': 'Где ставить сцену',
             'roster': 'Кому доверить первые раунды', 'sound': 'Как передавать музыку',
             'access': 'Где искать запасной вход', 'format': 'Как объявить раунды'}
SPEAKERS = {'act1': 'Винт', 'act2': 'Трафареты', 'act3': 'Шуруп', 'act4': 'Винт', 'act5': 'Клёпка',
            'act6': 'Литейка', 'act7': 'Волна', 'act8': 'Маятник', 'pulse': 'Маятник',
            'answer': 'Клёпка', 'decks': 'Винт', 'final': 'Волна'}


def location(route):
    district, anchor = route.split(':')
    return f'{DISTRICTS[district]} · {LOCATIONS[anchor]}'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('pure', type=Path)
    parser.add_argument('browser', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--checkpoints', type=Path)
    parser.add_argument('--legacy-city', type=Path)
    args = parser.parse_args()
    pure = json.loads(args.pure.read_text())
    browser = json.loads(args.browser.read_text())
    checkpoints = json.loads(args.checkpoints.read_text()) if args.checkpoints else {}
    legacy_city = json.loads(args.legacy_city.read_text()) if args.legacy_city else {}
    assert not checkpoints.get('errors') and not legacy_city.get('errors')
    stage = {episode['episode']: episode for episode in browser['episodes']}
    local_exams = {exam['id'] for exam in browser['exams']['reports']}
    assert len(stage) == 60 and len(local_exams) == 12
    assert not browser['errors'] and not browser['externalRequests']
    with args.output.open('w', encoding='utf-8', newline='') as stream:
        table = csv.writer(stream, lineterminator='\n')
        table.writerow(('Линия', '№', 'Акт', 'Этап', 'Кто', 'Место', 'Подготовка и выбор', 'Действия',
                        'Следующий этап', 'Модель', 'Интерфейс Chromium', '3D и сервер',
                        'Активные виртуальные кадры', 'Верхняя граница p95 JS и DOM, мс',
                        'Активные изменения DOM', 'Сохранения'))
        for i, (chapter, detail) in enumerate(zip(pure['prologue'], PROLOGUE), 1):
            speaker, place, action = detail
            following = pure['prologue'][i]['title'] if i < len(PROLOGUE) else 'Общий сайфер состоялся'
            table.writerow(('Пролог', i, '', chapter['title'], speaker, place, '', action, following,
                            'Порядок, сохранение и награда', 'Переходы, цели и награды в CITY3D',
                            'Позиции и исходы — локальные фикстуры; отрисовка отключена', '', '', '', ''))
        for episode in pure['episodes']:
            observed = stage[episode['episode']]
            stages = observed['stageMetrics']['active']
            tasks = ' · '.join(p['mode'] for p in episode['active'])
            preparation = ' / '.join(
                [PREP[item] for item in episode['preparations']]
                + ([DECISIONS[episode['decision']]] if episode['decision'] else [])
                + (['Два сигнала входа'] if episode['cueChoices'] else []),
            )
            ui = 'Вход, бриф, игра, зачёт, пауза/продолжение, переход'
            physical = 'Виртуальный ритм и точки перехода; 3D и звук заглушены'
            if episode['episode'] == 1 and checkpoints.get('portraits'):
                portrait_test = checkpoints['portraits']
                ui += f"; два портрета на экране {portrait_test['viewport']} px"
            saved = checkpoints.get('legacyClub')
            if saved and episode['episode'] == saved['episode']:
                ui += f"; сохранение v1 прошло с доли {saved['fromBeat']} до {saved['savedBeat']} через reload"
            if legacy_city and episode['episode'] == legacy_city['location']['episode'] + 1:
                objects = legacy_city['stage']['children']
                actors = sum(item['person'] for item in objects)
                physical += f'; отдельно CITY3D из v1: {actors} рига, декорации, свет и очистка'
            table.writerow(('Фестиваль', episode['episode'], episode['act'], episode['title'], episode['speaker'],
                            ' / '.join(location(route) for route in episode['routes']), preparation, tasks,
                            episode['reward']['advancesTo'], f"{pure['sourceTotals']['paths']} путей; ритм, зачёт и сохранение",
                            ui, physical, stages['frames'], stages['p95BucketMs'], stages['domRecords'], observed['saveCount']))
        for i, exam in enumerate(pure['exams'], 1):
            kind = 'Контрольная акта' if i <= 8 else ('Финал' if exam['id'] == 'final' else 'Отбор')
            following = pure['exams'][i]['title'] if i < len(local_exams) else 'Мифический комплект'
            table.writerow((kind, i, min(i, 8), exam['title'], SPEAKERS[exam['id']], 'Судимая площадка',
                            '', exam['modes'], following, 'Три темпа, зачёт и пустой ввод',
                            'Локальная тренировка с итогами', 'Официальный результат серверу не отправлялся', '', '', '', ''))


if __name__ == '__main__':
    main()
