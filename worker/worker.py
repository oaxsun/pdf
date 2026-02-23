import os
import time
from redis import Redis
from rq import Worker, Queue, Connection

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

listen = ["pdf"]

conn = Redis.from_url(REDIS_URL)

if __name__ == "__main__":
    with Connection(conn):
        worker = Worker(map(Queue, listen))
        worker.work(with_scheduler=True)
