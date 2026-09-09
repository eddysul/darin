from __future__ import annotations

import unittest

from fastapi.testclient import TestClient

from server.ai.app.factory import create_app
from server.ai.tests.support import (
    FakeLlmProvider,
    FakeSttProvider,
    FakeVerifier,
    auth_headers,
    consult_body,
    insight_body,
    test_settings,
    weekly_body,
)


class OutputSafetyTests(unittest.TestCase):
    def execute(self, provider_result, body):
        app = create_app(
            settings=test_settings(),
            verifier=FakeVerifier(),
            llm_provider=FakeLlmProvider(provider_result),
            stt_provider=FakeSttProvider(),
        )
        return TestClient(app, raise_server_exceptions=False).post(
            "/v1/ai/execute", json=body, headers=auth_headers()
        )

    def assert_rejected(self, response) -> None:
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["error"]["code"], "OUTPUT_REJECTED")
        self.assertTrue(response.json()["fallbackRecommended"])

    def test_medical_judgment_response_is_rejected(self) -> None:
        self.assert_rejected(self.execute({"answer": "420분이면 정상이에요.", "used_fact_indexes": [0]}, consult_body()))

    def test_unsupported_number_is_rejected(self) -> None:
        self.assert_rejected(self.execute({"answer": "수면 기록은 999분이에요.", "used_fact_indexes": [0]}, consult_body()))

    def test_wrong_locale_output_is_rejected(self) -> None:
        body = consult_body()
        body["locale"] = "en"
        self.assert_rejected(self.execute({"answer": "수면 기록은 420분이에요.", "used_fact_indexes": [0]}, body))

    def test_consult_unknown_fact_index_is_rejected(self) -> None:
        result = {"answer": "수면 기록은 420분이에요.", "used_fact_indexes": [4]}
        self.assert_rejected(self.execute(result, consult_body()))

    def test_incomplete_history_cannot_be_called_zero(self) -> None:
        body = consult_body()
        body["input"]["history_complete"] = False
        self.assert_rejected(self.execute({"answer": "수면 기록이 0건이에요.", "used_fact_indexes": [0]}, body))

    def test_weekly_metric_number_mismatch_is_rejected(self) -> None:
        result = {
            "metric": "sleepMinutes",
            "headline": "밤잠 기록이 달라졌어요",
            "body": "수유는 5회에서 6회로 달라졌어요.",
        }
        self.assert_rejected(self.execute(result, weekly_body()))

    def test_weekly_unsupported_number_is_rejected(self) -> None:
        result = {
            "metric": "sleepMinutes",
            "headline": "밤잠 기록이 달라졌어요",
            "body": "지난 기록 390분에서 이번 기록 420분으로 30분 달라졌어요.",
        }
        self.assert_rejected(self.execute(result, weekly_body()))

    def test_insight_invented_number_is_rejected(self) -> None:
        result = {
            "phrases": [
                {"id": "feed-sleep", "text": "수유 간격 20분과 수면 30분의 관련성이 99%예요."}
            ]
        }
        self.assert_rejected(self.execute(result, insight_body()))

    def test_insight_wrong_relation_id_is_rejected(self) -> None:
        result = {
            "phrases": [
                {"id": "other-relation", "text": "수유 간격이 20분 길 때 수면도 30분 길었어요."}
            ]
        }
        self.assert_rejected(self.execute(result, insight_body()))


if __name__ == "__main__":
    unittest.main()
