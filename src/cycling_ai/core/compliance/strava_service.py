from typing import List

import requests

from .models import StreamPoint

class StravaClient:
    def __init__(self, access_token: str):
        self.base_url = "https://www.strava.com/api/v3"
        self.headers = {"Authorization": f"Bearer {access_token}"}

    def get_power_streams(self, activity_id: int) -> List[StreamPoint]:
        """Fetches 'watts' and 'time' streams from Strava."""
        url = f"{self.base_url}/activities/{activity_id}/streams"
        params = {"keys": "watts,time", "key_by_type": "true"}
        
        response = requests.get(url, headers=self.headers, params=params)
        response.raise_for_status()
        data = response.json()
        
        watts = data['watts']['data']
        times = data['time']['data']
        
        return [StreamPoint(time_offset=t, power=w) for t, w in zip(times, watts)]
