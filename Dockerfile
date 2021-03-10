FROM python:3.7

COPY ./fastapi /app
WORKDIR /app

RUN pip install fastapi uvicorn
RUN pip install -r requirements.txt
RUN pip install opencv-python-headless
RUN pip install uvicorn[standard]

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5000"]