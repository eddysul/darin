import unittest
from fastapi.testclient import TestClient
from server.ai.app.factory import create_app
from server.ai.app.voice_grounding import validate, VoiceGroundingError
from server.ai.tests.support import FakeLlmProvider, FakeSttProvider, FakeVerifier, test_settings, auth_headers, VALID_M4A


class VoiceGroundingTests(unittest.TestCase):
    def route(self, transcript, events, expected, reason=None):
        llm = FakeLlmProvider({"events": events})
        stt = FakeSttProvider(transcript)
        client = TestClient(create_app(settings=test_settings(), verifier=FakeVerifier(),
                                      llm_provider=llm, stt_provider=stt))
        with self.assertLogs("darin.ai", level="INFO") as logs:
            r = client.post('/v1/transcribe', headers=auth_headers(),
                            files={'file': ('synthetic.m4a', VALID_M4A, 'audio/m4a')})
        self.assertEqual(r.status_code, expected, r.text)
        self.assertEqual(len(stt.requests), 1)
        self.assertEqual(len(llm.requests), 1)
        if reason:
            self.assertEqual(r.json()['error']['code'], 'OUTPUT_REJECTED')
            self.assertNotIn(reason, r.text)
            self.assertIn(reason, ' '.join(logs.output))
            self.assertNotIn(transcript, ' '.join(logs.output))
        else:
            for event in r.json()['events']:
                self.assertNotIn('source_text',event)
                self.assertNotIn('amount_unit',event)
        return r

    def test_required_success_cases(self):
        cases = [
            ('분유 120ml 먹었어요', [{'category':'식사','amount':120,'amount_unit':'ml'}]),
            ('30분 잤어요', [{'category':'수면','duration_min':30}]),
            ('기저귀 갈았어요', [{'category':'배변'}]),
            ('목욕했어요', [{'category':'목욕'}]),
            ('분유 120ml 먹고 30분 잤어요', [{'category':'식사','amount':120,'source_text':'분유 120ml 먹고'}, {'category':'수면','duration_min':30,'source_text':'30분 잤어요'}]),
            ('At three PM, formula feeding, one hundred twenty milliliters.', [{'category':'식사','time':'15:00','type':'formula','amount':120,'amount_unit':'ml'}]),
            ('At 3:00 PM, formula 120 mL.', [{'category':'식사','time':'15:00','amount':120,'source_text':'At 3:00 PM, formula 120 mL.'}]),
            ('키 60cm 몸무게 7kg',[{'category':'키 몸무게의 변화','height_cm':60,'weight_kg':7}]),
            ('체온 37도 실내 온도 25도',[{'category':'온도/습도','body_temp':37,'room_temp':25}]),
        ]
        for t,events in cases:
            with self.subTest(t=t):self.route(t,events,200)

    def test_units(self):
        for unit in ['ml','mL','밀리리터','milliliters','millilitres','毫升','ミリリットル','mililitros']:
            with self.subTest(unit=unit):self.route('분유 120'+unit,[{'category':'식사','amount':120,'amount_unit':unit}],200)
        for unit in ['분','minutes','min','分钟','分','minutos']:
            with self.subTest(unit=unit):self.route('sleep 30'+unit,[{'category':'수면','duration_min':30}],200)

    def test_rejections(self):
        cases=[
            ('수면 30분, 분유 120ml',[{'category':'수면','duration_min':120},{'category':'식사','amount':30}], 'NUMBER_UNIT_NOT_GROUNDED'),
            ('수면 30분, 분유 120ml',[{'category':'식사','amount':30}], 'NUMBER_UNIT_NOT_GROUNDED'),
            ('분유 120분',[{'category':'식사','amount':120}], 'NUMBER_UNIT_NOT_GROUNDED'),
            ('분유 120ml',[{'category':'식사','amount':120,'amount_unit':'minutes'}], 'UNIT_NOT_GROUNDED'),
            ('목욕 안 했어',[{'category':'목욕'}], 'EVENT_NOT_CONFIRMED'),
            ('목욕 안했어요',[{'category':'목욕'}], 'EVENT_NOT_CONFIRMED'),
            ('수면 30분 분유 120ml',[{'category':'수면','duration_min':120}], 'AMBIGUOUS_EVENT_SPAN'),
            ('체온 37도 실내 온도 25도',[{'category':'온도/습도','body_temp':25}], 'NUMBER_UNIT_NOT_GROUNDED'),
            ('목욕하려고 했어요',[{'category':'목욕'}], 'EVENT_NOT_CONFIRMED'),
            ('목욕했나?',[{'category':'목욕'}], 'EVENT_NOT_CONFIRMED'),
            ('did not take a bath',[{'category':'목욕'}], 'EVENT_NOT_CONFIRMED'),
            ('분유 120ml',[{'category':'feeding'}], 'STRUCTURE_INVALID'),
            ('분유 120ml',[{'category':'식사','amount':999}], 'NUMBER_UNIT_NOT_GROUNDED'),
            ('분유 120ml',[{'category':'식사','note':'happy'}], 'TEXT_FIELD_NOT_GROUNDED'),
            ('분유 120ml',[{'category':'식사','source_text':'분유 999ml'}], 'SOURCE_EVIDENCE_MISMATCH'),
            ('목욕 안 했어',[{'category':'목욕','source_text':'목욕'}], 'EVENT_NOT_CONFIRMED'),
            ('분유 120ml',[{'category':'식사','amount':120,'unit':'ml'}], 'STRUCTURE_INVALID'),
        ]
        for t,events,reason in cases:
            with self.subTest(t=t,events=events): self.route(t,events,422,reason)

    def test_same_category_cannot_borrow_quantity(self):
        self.route('분유 120ml, 분유 30ml',[{'category':'식사','amount':30,'source_text':'분유 120ml'}],422,'NUMBER_UNIT_NOT_GROUNDED')
        self.route('분유 120ml 이후 분유 30ml',[{'category':'식사','amount':30}],422,'AMBIGUOUS_EVENT_SPAN')

    def test_partial_source_success(self):
        for transcript, events in [
            ('분유 120ml 먹었어요',[{'category':'식사','source_text':'분유 120ml','amount':120}]),
            ('30분 잤어요',[{'category':'수면','source_text':'30분','duration_min':30}]),
            ('분유 120ml 먹고 30분 잤어요',[{'category':'식사','source_text':'분유 120ml','amount':120},{'category':'수면','source_text':'30분 잤어요','duration_min':30}]),
            ('기저귀 갈았어요',[{'category':'배변','source_text':'기저귀'}]),
            ('목욕했어요',[{'category':'목욕','source_text':'목욕'}]),
            ('At three PM, formula feeding, one hundred twenty milliliters.',[{'category':'식사','source_text':'formula feeding, one hundred twenty milliliters','amount':120,'amount_unit':'ml'}]),
        ]:
            with self.subTest(transcript=transcript): self.route(transcript,events,200)

    def test_partial_source_context(self):
        for transcript in ['목욕 안 했어요','목욕하지 않았어요','목욕 안 함','목욕 못 했어요','목욕하려고 해요','목욕했어?','목욕했다고 안 했어요']:
            with self.subTest(transcript=transcript):
                self.route(transcript,[{'category':'목욕','source_text':'목욕'}],422,'EVENT_NOT_CONFIRMED')
        for transcript in ['이제 분유 120ml 먹일 거예요','분유 120ml 먹었나?']:
            with self.subTest(transcript=transcript):
                self.route(transcript,[{'category':'식사','source_text':'분유 120ml','amount':120}],422,'EVENT_NOT_CONFIRMED')
        self.route('bath and not done',[{'category':'목욕','source_text':'bath'}],422,'EVENT_NOT_CONFIRMED')

    def test_partial_source_reject(self):
        cases = [
            ('분유 120ml 먹고 30분 잤어요',{'category':'식사','source_text':'분유 120ml','amount':30},'NUMBER_UNIT_NOT_GROUNDED'),
            ('분유 120ml 먹고 30분 잤어요',{'category':'수면','source_text':'30분 잤어요','duration_min':120},'NUMBER_UNIT_NOT_GROUNDED'),
            ('분유 120ml 먹었어요',{'category':'식사','source_text':'분유 120ml','amount':120,'amount_unit':'minutes'},'UNIT_NOT_GROUNDED'),
            ('분유 120ml 먹었어요',{'category':'식사','source_text':'분유를 120밀리리터 먹음','amount':120},'SOURCE_EVIDENCE_MISMATCH'),
            ('분유 120ml 먹었어요',{'category':'식사','source_text':'분유 999ml','amount':999},'SOURCE_EVIDENCE_MISMATCH'),
            ('분유 120ml 먹고, 나중에 또 분유 120ml 먹었어요',{'category':'식사','source_text':'분유 120ml','amount':120},'SOURCE_AMBIGUOUS'),
            ('분유 120ml 먹었어요',{'category':'식사','source_text':'20ml','amount':20},'SOURCE_EVIDENCE_MISMATCH'),
            ('분유 120ml 먹고 30분 잤어요',{'category':'식사','source_text':'분유','amount':120},'NUMBER_UNIT_NOT_GROUNDED'),
        ]
        for transcript,event,reason in cases:
            with self.subTest(event=event): self.route(transcript,[event],422,reason)

    def test_legacy_repro_diagnostics(self):
        with self.assertRaises(VoiceGroundingError) as caught:
            validate({'events':[{'category':'식사','type':'분유','amount':120}]},'formula 120ml')
        self.assertEqual(caught.exception.validation_reason,'TEXT_FIELD_NOT_GROUNDED')

    def test_clock_context_success(self):
        for text, expected in [('8 AM','08:00'),('8:30 PM','20:30'),('08:00','08:00'),('8:00','08:00'),('eight in the morning','08:00'),('three PM','15:00'),('three p.m.','15:00'),('12 AM','00:00'),('12 PM','12:00')]:
            with self.subTest(clock=text):
                self.route(f'At {text}, formula feeding, one hundred twenty milliliters.',[{'category':'식사','source_text':'formula feeding, one hundred twenty milliliters','amount':120,'amount_unit':'ml','time':expected}],200)
        for text, expected in [('오전 8시','08:00'),('오전 8시 30분','08:30'),('오후 8시 30분','20:30')]:
            with self.subTest(clock=text):
                self.route(f'{text}에 분유 120ml 먹었어요',[{'category':'식사','source_text':'분유 120ml','amount':120,'time':expected}],200)
        self.route('오전 8시에 분유 120ml 먹고 30분 잤어요',[
            {'category':'식사','source_text':'분유 120ml','amount':120,'time':'08:00'},
            {'category':'수면','source_text':'30분 잤어요','duration_min':30}],200)
        self.route('30분 잤어요',[{'category':'수면','duration_min':30}],200)

    def test_clock_reject(self):
        for text, value in [('분유 120ml 먹었어요','08:00'),('8시에 먹었어요','09:00'),('오전 8시 30분에 먹었어요','08:00'),('8시쯤 먹었어요','08:00'),('아침에 먹었어요','08:00'),('조금 전에 먹었어요','08:00'),('점심 무렵 먹었어요','12:00'),('around 8 AM formula','08:00'),('8:99 PM formula','20:00'),('25:00 formula','01:00'),('8 AM formula','8:00'),('8 AM formula','tomorrow'),('formula 120ml','01:20')]:
            with self.subTest(text=text):
                self.route(text,[{'category':'식사','time':value}],422,'TIME_NOT_GROUNDED')
        self.route('30분 잤어요',[{'category':'수면','duration_min':30,'time':'00:30'}],422,'TIME_NOT_GROUNDED')
        self.route('오전 8시에 분유 120ml 먹고 30분 잤어요',[
            {'category':'수면','source_text':'30분 잤어요','duration_min':30,'time':'08:00'}],422,'TIME_NOT_GROUNDED')
        for field in ['time_start','time_end']:
            self.route('30분 잤어요',[{'category':'수면',field:'08:00'}],422,'TIME_NOT_GROUNDED')
        for text in ['오전 8시경에 먹었어요','8:00amish formula','8 AM or 9 AM formula']:
            self.route(text,[{'category':'식사','time':'08:00'}],422,'TIME_NOT_GROUNDED')

    def test_clock_minutes_are_not_duration(self):
        for source in [None,'30분 잤어요']:
            event={'category':'수면','duration_min':30}
            if source:event['source_text']=source
            self.route('오전 8시 30분 잤어요',[event],422,'NUMBER_UNIT_NOT_GROUNDED')
        self.route('오전 8시 30분에 20분 잤어요',[{'category':'수면','duration_min':20,'time':'08:30'}],200)
