import unittest

from video_authorization import (
    MatchVideoAuthorizationError,
    authorize_supervised_video_room,
    parse_supervised_video_request,
)


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
                {"id": "match-2", "status": "accepted", "acceptance": {"waliId": "wali-1"}},
            ]
        }

        with self.assertRaises(MatchVideoAuthorizationError):
            authorize_supervised_video_room("user-1", "match-1", match_doc)
        with self.assertRaises(MatchVideoAuthorizationError):
            authorize_supervised_video_room("user-1", "missing", match_doc)

    def test_authorize_supervised_video_returns_stable_pair_scoped_room(self):
        match_doc = {
            "matches": [
                {
                    "id": "match-1",
                    "status": "accepted",
                    "acceptance": {"waliId": "wali-1", "status": "accepted"},
                }
            ]
        }

        result = authorize_supervised_video_room(" user-1 ", " match-1 ", match_doc)

        self.assertEqual(result.room, "marriage_match_match-1_user-1")
        self.assertEqual(result.match_id, "match-1")
        self.assertEqual(result.wali_id, "wali-1")

    def test_supervised_room_name_is_stable_for_both_match_participants(self):
        user_doc = {
            "matches": [{"id": "user-2", "status": "accepted", "acceptance": {"waliId": "wali-1"}}]
        }
        matched_user_doc = {
            "matches": [{"id": "user-1", "status": "accepted", "acceptance": {"waliId": "wali-2"}}]
        }

        user_room = authorize_supervised_video_room("user-1", "user-2", user_doc).room
        matched_user_room = authorize_supervised_video_room("user-2", "user-1", matched_user_doc).room

        self.assertEqual(user_room, "marriage_match_user-1_user-2")
        self.assertEqual(matched_user_room, user_room)

    def test_authorize_supervised_video_rejects_malformed_match_documents(self):
        with self.assertRaises(MatchVideoAuthorizationError):
            authorize_supervised_video_room("user-1", "match-1", None)
        with self.assertRaises(MatchVideoAuthorizationError):
            authorize_supervised_video_room("user-1", "match-1", {"matches": {}})


if __name__ == "__main__":
    unittest.main()
