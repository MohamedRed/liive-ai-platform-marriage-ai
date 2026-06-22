import unittest

from video_authorization import (
    MatchVideoAuthorizationError,
    authorize_supervised_video_room,
    parse_supervised_video_request,
)


def accepted_match(candidate_id: str, wali_id: str = "wali-1") -> dict:
    return {"id": candidate_id, "status": "accepted", "acceptance": {"waliId": wali_id, "status": "accepted"}}


class SupervisedVideoAuthorizationTests(unittest.TestCase):
    def test_parse_supervised_video_request_canonicalizes_match_id(self):
        self.assertEqual(parse_supervised_video_request({"matchId": " match-1 "}), "match-1")
        self.assertEqual(parse_supervised_video_request({"matchedUserId": " match-2 "}), "match-2")

    def test_parse_supervised_video_request_rejects_missing_match_id(self):
        for payload in (None, {}, {"matchId": ""}, {"matchedUserId": 123}):
            with self.assertRaises(MatchVideoAuthorizationError):
                parse_supervised_video_request(payload)

    def test_authorize_supervised_video_requires_existing_accepted_match(self):
        match_doc = {
            "matches": [
                {"id": "match-1", "status": "pending"},
                accepted_match("match-2"),
            ]
        }
        reciprocal_doc = {"matches": [accepted_match("user-1", "wali-2")]}

        with self.assertRaises(MatchVideoAuthorizationError):
            authorize_supervised_video_room("user-1", "match-1", match_doc, reciprocal_doc)
        with self.assertRaises(MatchVideoAuthorizationError):
            authorize_supervised_video_room("user-1", "missing", match_doc, reciprocal_doc)

    def test_authorize_supervised_video_returns_stable_pair_scoped_room(self):
        match_doc = {"matches": [accepted_match("match-1", "wali-1")]}
        reciprocal_doc = {"matches": [accepted_match("user-1", "wali-2")]}

        result = authorize_supervised_video_room(" user-1 ", " match-1 ", match_doc, reciprocal_doc)

        self.assertEqual(result.room, "marriage_match_match-1_user-1")
        self.assertEqual(result.match_id, "match-1")
        self.assertEqual(result.matched_user_id, "match-1")
        self.assertEqual(result.wali_id, "wali-1")
        self.assertEqual(result.matched_user_wali_id, "wali-2")

    def test_supervised_room_name_is_stable_for_both_match_participants(self):
        user_doc = {"matches": [accepted_match("user-2", "wali-1")]}
        matched_user_doc = {"matches": [accepted_match("user-1", "wali-2")]}

        user_room = authorize_supervised_video_room("user-1", "user-2", user_doc, matched_user_doc).room
        matched_user_room = authorize_supervised_video_room("user-2", "user-1", matched_user_doc, user_doc).room

        self.assertEqual(user_room, "marriage_match_user-1_user-2")
        self.assertEqual(matched_user_room, user_room)

    def test_authorize_supervised_video_requires_reciprocal_accepted_match(self):
        user_doc = {"matches": [accepted_match("user-2", "wali-1")]}

        with self.assertRaisesRegex(MatchVideoAuthorizationError, "Reciprocal match document"):
            authorize_supervised_video_room("user-1", "user-2", user_doc, None)
        with self.assertRaisesRegex(MatchVideoAuthorizationError, "reciprocal accepted match"):
            authorize_supervised_video_room("user-1", "user-2", user_doc, {"matches": []})
        with self.assertRaisesRegex(MatchVideoAuthorizationError, "reciprocal accepted match"):
            authorize_supervised_video_room(
                "user-1",
                "user-2",
                user_doc,
                {"matches": [{"id": "user-1", "status": "pending", "acceptance": {"waliId": "wali-2"}}]},
            )
        with self.assertRaisesRegex(MatchVideoAuthorizationError, "reciprocal wali authorization"):
            authorize_supervised_video_room(
                "user-1",
                "user-2",
                user_doc,
                {"matches": [{"id": "user-1", "status": "accepted", "acceptance": {}}]},
            )

    def test_authorize_supervised_video_rejects_malformed_match_documents(self):
        with self.assertRaises(MatchVideoAuthorizationError):
            authorize_supervised_video_room("user-1", "match-1", None, {"matches": []})
        with self.assertRaises(MatchVideoAuthorizationError):
            authorize_supervised_video_room("user-1", "match-1", {"matches": {}}, {"matches": []})


if __name__ == "__main__":
    unittest.main()
