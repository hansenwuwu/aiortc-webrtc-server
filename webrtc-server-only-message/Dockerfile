FROM python:3.7

COPY ./app /app
WORKDIR /app

RUN pip install fastapi uvicorn
RUN pip install -r requirements.txt
RUN pip install opencv-python-headless
RUN pip install websockets

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5000"]