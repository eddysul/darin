"""No-network provider-contract matrix for the single staging TTS sentence."""
import itertools
import unittest

from server.ai.tests import test_voice_grounding as harness


class VoiceIntegrationMatrixTests(unittest.TestCase):
    route = harness.VoiceGroundingTests.route

    def test_normal_provider_variants_return_real_event(self):
        clocks = ['3 PM', '3 p.m.', 'three PM', 'three p. m.', '3:00 PM', '15:00']
        amounts = ['120 ml', '120 mL', 'one hundred twenty milliliters',
                   'one hundred and twenty millilitres']
        combinations = itertools.product(clocks, amounts, ['full', 'partial', 'omitted'],
                                         ['omitted', 'null', 'exact_text'])
        tested = 0
        for clock, amount, span, optional in combinations:
            phrase = f'formula feeding, {amount}'
            transcript = f'At {clock}, {phrase}.'
            event = {'category': '식사', 'amount': 120, 'amount_unit': 'ml', 'time': '15:00'}
            if span != 'omitted':
                event['source_text'] = transcript if span == 'full' else phrase
            if optional == 'null':
                event.update(type=None, note=None, time_start=None, time_end=None,
                             duration_min=None, color=None)
            elif optional == 'exact_text':
                event.update(type='formula', note=phrase)
            with self.subTest(clock=clock, amount=amount, span=span, optional=optional):
                response = self.route(transcript, [event], 200)
                events = response.json()['events']
                self.assertEqual(len(events), 1)  # Empty-event 200 is not success.
                self.assertEqual(events[0]['category'], '식사')
                self.assertEqual(events[0]['amount'], 120)
                self.assertEqual(events[0]['time'], '15:00')
                tested += 1
        self.assertEqual(tested, 216)

    def test_normalization_does_not_relax_grounding(self):
        phrase = 'formula feeding, one hundred and twenty milliliters'
        transcript = f'At three PM, {phrase}.'
        base = {'category':'식사','source_text':phrase,'amount':120,'amount_unit':'ml','time':'15:00'}
        for change, reason in [
            ({'amount':20}, 'NUMBER_UNIT_NOT_GROUNDED'),
            ({'amount':100}, 'NUMBER_UNIT_NOT_GROUNDED'),
            ({'time':'03:00'}, 'TIME_NOT_GROUNDED'),
            ({'time':'16:00'}, 'TIME_NOT_GROUNDED'),
            ({'amount_unit':'minutes'}, 'UNIT_NOT_GROUNDED'),
            ({'type':'분유'}, 'TEXT_FIELD_NOT_GROUNDED'),
            ({'note':'happy baby'}, 'TEXT_FIELD_NOT_GROUNDED'),
            ({'source_text':'formula feeding, 120 milliliters'}, 'SOURCE_EVIDENCE_MISMATCH'),
        ]:
            with self.subTest(change=change): self.route(transcript,[{**base,**change}],422,reason)
        for prefix in ['Did not do ', 'Planning ', 'Will do ']:
            self.route(prefix + phrase, [{**base, 'time':None}],422,'EVENT_NOT_CONFIRMED')
        self.route('At three PM, '+phrase+'?', [base],422,'EVENT_NOT_CONFIRMED')

    def test_optional_null_and_absent_fields(self):
        transcript = 'At three PM, formula feeding, one hundred twenty milliliters.'
        for clock in ['absent', None]:
            for source in ['absent', None]:
                for unit in ['absent', None]:
                    event = {'category':'식사','amount':120}
                    for field, value in [('time',clock),('source_text',source),('amount_unit',unit)]:
                        if value != 'absent': event[field] = value
                    with self.subTest(clock=clock,source=source,unit=unit):
                        r = self.route(transcript,[event],200)
                        self.assertEqual(len(r.json()['events']),1)
                        self.assertEqual(r.json()['events'][0]['amount'],120)
                        self.assertIsNone(r.json()['events'][0]['time'])

    def test_other_event_time_and_number_cannot_be_borrowed(self):
        transcript = 'At three PM, formula 120ml and at four PM, slept 30 minutes.'
        for event, reason in [
            ({'category':'식사','source_text':'formula 120ml','amount':30},'NUMBER_UNIT_NOT_GROUNDED'),
            ({'category':'수면','source_text':'slept 30 minutes','duration_min':120},'NUMBER_UNIT_NOT_GROUNDED'),
            ({'category':'식사','source_text':'formula 120ml','time':'16:00'},'TIME_NOT_GROUNDED'),
            ({'category':'수면','source_text':'slept 30 minutes','time':'15:00'},'TIME_NOT_GROUNDED'),
        ]:
            with self.subTest(event=event): self.route(transcript,[event],422,reason)
