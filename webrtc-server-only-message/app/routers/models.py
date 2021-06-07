from fastapi import APIRouter, status, File, UploadFile, Form
from typing import List, cast, Optional
from pymongo import MongoClient
from pydantic import BaseModel
import os
import string
import random
import shutil
from datetime import datetime

router = APIRouter(
    prefix="/api/v1/model",
)

DB = os.getenv('EA_DB')
MSG_COLLECTION = os.getenv('EA_COLLECTION')

class Model(BaseModel):
    qrcode: Optional[str]
    date: Optional[datetime]
    name: Optional[str]
    filePath: Optional[str]

@router.post("/")
async def create_upload_file(
    file: UploadFile = File(...), name: str = Form(...)
):
    qrcode = ''.join(random.choice(string.ascii_uppercase + string.digits) for _ in range(9))
    date = datetime.now().strftime("%d/%m/%Y %H:%M:%S")

    os.makedirs('storage/'+name+"_"+qrcode)
    filePath = 'storage/'+name+"_"+qrcode+"/"+file.filename
    fullFilePath = os.path.join(os.getcwd(), filePath)

    try:
        with open(filePath, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except:
        return {"detail": "saving file fail"}

    model = Model(
        qrcode=qrcode,
        name=name,
        filePath=fullFilePath,
        date=datetime.now()
    )

    with MongoClient() as client:
        msg_collection = client[DB][MSG_COLLECTION]
        result = msg_collection.insert_one(model.dict())
        ack = result.acknowledged

    return {
        "filename": file.filename, 
        "content_type": file.content_type, 
        "qrcode":qrcode,
        "date": date,
        "name": name,
        "fullFilePath" : fullFilePath,
        "ack":ack 
        }

@router.get("/", response_model=List[Model])
def get_messages():
    with MongoClient() as client:
        msg_collection = client[DB][MSG_COLLECTION]
        msg_list = msg_collection.find()
        response_msg_list = []
        for msg in msg_list:
            response_msg_list.append(Model(**msg))
        return response_msg_list

@router.get("/{qrcode}", response_model=List[Model])
def get_messages(qrcode: str):
    with MongoClient() as client:
        msg_collection = client[DB][MSG_COLLECTION]
        msg_list = msg_collection.find({"qrcode": qrcode})
        response_msg_list = []
        for msg in msg_list:
            response_msg_list.append(Model(**msg))
        return response_msg_list

@router.delete("/{qrcode}", response_description="Model data deleted from the database")
async def delete_model_data(qrcode: str):
    with MongoClient() as client:
        msg_collection = client[DB][MSG_COLLECTION]

        msg_list = msg_collection.find({"qrcode": qrcode})
        response_msg_list = []
        for msg in msg_list:
            response_msg_list.append(Model(**msg))
        if len(response_msg_list)==0:
            return {"result": "no such model"}
        file_path = response_msg_list[0].filePath
        file_parent_path = os.path.dirname(file_path)

        result = msg_collection.delete_one({"qrcode": qrcode})
        ack = result.acknowledged

        # delete file
        if os.path.exists(file_path) and os.path.isfile(file_path):
            os.remove(file_path)
        else:
            return {"ack": ack}
        
        if os.path.exists(file_parent_path):
            os.removedirs(file_parent_path)

    return { "ack":ack }