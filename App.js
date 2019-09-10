'use strict';
import React, {PureComponent} from 'react';
import {
  AppRegistry,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
  ScrollView,
  PermissionsAndroid,
  ActivityIndicator,
} from 'react-native';
import {RNCamera} from 'react-native-camera';
import RNTesseractOcr from 'react-native-tesseract-ocr';
import RNFetchBlob from 'react-native-fetch-blob';
import uuidv1 from 'uuid/v1';

const PendingView = () => (
  <View
    style={{
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    }}>
    <Text>Waiting</Text>
  </View>
);

const PopupWindow = props => (
  <View
    style={{
      flex: 1,
      width: '100%',
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
    }}>
    <View
      style={{
        width: '80%',
        minHeight: '50%',
        maxHeight: '70%',
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 20,
      }}>
      <ScrollView>
        <View>
          <Text style={{fontWeight: 'bold', fontSize: 20, marginTop: 5}}>
            Snapshot
          </Text>
          <Image
            source={{isStatic: true, uri: props.snapshot}}
            style={{height: 125, maxWidth: '100%'}}
            resizeMode={'stretch'}
          />
          <Text style={{fontWeight: 'bold', fontSize: 20, marginTop: 5}}>
            Scan Value
          </Text>
          <Text>{props.value}</Text>
          <Text style={{fontWeight: 'bold', fontSize: 20, marginTop: 5}}>
            Action
          </Text>
          <TouchableOpacity onPress={props.clickedNext}>
            <View
              style={{
                backgroundColor: 'blue',
                alignSelf: 'flex-start',
                paddingHorizontal: 10,
                paddingVertical: 5,
              }}>
              <Text style={{fontSize: 20, color: 'white'}}>Scan Next</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  </View>
);

export default class ExampleApp extends PureComponent {
  cameraRef;
  intervalref = null;
  initialState = {
    found: false,
    foundText: '',
    snapshot: '',
    loadingOCR: false,
  };
  state = {
    ...this.initialState,
  };

  async requestWritePermission() {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        {
          title: 'Required Write permission',
          message: 'We need your file write permissions to save image',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        },
      );
      if (granted === PermissionsAndroid.RESULTS.GRANTED) {
        console.log('granted');
        // this.takePicture();
        return true;
      } else {
        console.log('denied');
        return false;
      }
    } catch (err) {
      console.log('Error');
      console.warn(err);
      return false;
    }
  }

  render() {
    const {found, foundText, snapshot, loadingOCR} = this.state;
    return (
      <View style={styles.container}>
        <RNCamera
          ref={refs => {
            this.cameraRef = refs;
          }}
          style={styles.preview}
          type={RNCamera.Constants.Type.back}
          flashMode={RNCamera.Constants.FlashMode.off}
          onBarCodeRead={this.onReadBarcode}
           onTextRecognized={{this.onReadText}}
          androidCameraPermissionOptions={{
            title: 'Permission to use camera',
            message: 'We need your permission to use your camera',
            buttonPositive: 'Ok',
            buttonNegative: 'Cancel',
          }}
          androidRecordAudioPermissionOptions={{
            title: 'Permission to use audio recording',
            message: 'We need your permission to use your audio',
            buttonPositive: 'Ok',
            buttonNegative: 'Cancel',
          }}>
          {({camera, status, recordAudioPermissionStatus}) => {
            if (status !== 'READY') {
              return <PendingView />;
            }
            if (status === 'READY') {
              this.requestWritePermission();
            }
            if (found) {
              return (
                <PopupWindow
                  value={foundText}
                  snapshot={snapshot}
                  clickedNext={this.clickedNext}
                />
              );
            }
            return (
              <View
                style={{
                  flex: 0,
                  flexDirection: 'row',
                  justifyContent: 'center',
                }}>
                <TouchableOpacity
                  onPress={() => this.takePicture(camera)}
                  style={styles.capture}>
                  <Text style={{fontSize: 14}}> Scan OCR </Text>
                </TouchableOpacity>
              </View>
            );
          }}
        </RNCamera>
      </View>
    );
  }

  clickedNext = () => {
    console.log('clicked next');
    this.setState(
      {
        found: false,
        foundText: '',
        snapshot: '',
        loadingOCR: false,
      },
      () => {
        console.log('state saved');
      },
    );
  };

  onReadBarcode = async (data, rawData, type, bounds) => {
    if (!this.state.found) {
      const options = {quality: 0.3, base64: true};
      const img = await this.cameraRef.takePictureAsync(options);
      this.setState({found: true, foundText: data.data, snapshot: img.uri});
    }
  };
  
    onReadText = async (data, rawData, type, bounds) => {
    if (!this.state.found) {
      const options = {quality: 0.3, base64: true};
      const img = await this.cameraRef.takePictureAsync(options);
      this.setState({found: true, foundText: data.data, snapshot: img.uri});
    }
  };

  takePicture = function(camera) {
    if (!this.state.found) {
      this.setState({loadingOCR: true}, async () => {
        const file_folder = `${RNFetchBlob.fs.dirs.PictureDir}`;
        const file_path = `${file_folder}/${uuidv1()}.jpg`;
        const options = {quality: 0.3, base64: true};
        const data = await this.cameraRef.takePictureAsync(options);
        // data.uri = data.uri.replace('file://', '');
        const checkFileAvailable = await RNFetchBlob.fs.exists(data.uri);
        if (checkFileAvailable) {
          console.log('file found');

          const base64Img = await RNFetchBlob.fs.readFile(data.uri, 'base64');
          await RNFetchBlob.fs.writeFile(file_path, base64Img, 'base64');
          console.log('File write completed');
          if (!this.state.found) {
            this.extractTextFromImage(file_path)
              .then(async text => {
                if (!this.state.found) {
                  await RNFetchBlob.fs.unlink(file_path);
                  console.warn('text : ', text);
                  //  eslint-disable-next-line
                  this.setState({
                    found: true,
                    foundText: text,
                    snapshot: data.uri,
                    loadingOCR: false,
                  });
                }
              })
              .catch(err => {
                console.log('Error : ', err);
                this.setState({
                  found: false,
                  foundText: '',
                  snapshot: '',
                  loadingOCR: false,
                });
              });
          }
        } else {
          this.setState({
            found: false,
            foundText: '',
            snapshot: '',
            loadingOCR: false,
          });
          console.log('File not found');
        }
      });
    }
    // this.intervalref = setInterval(() => {
    //   this.takePicture();
    // }, 15000);
  };

  extractTextFromImage = function(imagePath) {
    const tessOptions = {
      whitelist:
        'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890.',
      blacklist: null,
    };
    return new Promise((resolve, reject) => {
      RNTesseractOcr.recognize(imagePath, 'LANG_ENGLISH', tessOptions)
        .then(result => {
          console.log('result : ', result);
          resolve(result);
        })
        .catch(err => {
          console.log('err.message : ', err.message);
          reject(err.message);
        });
    });
  };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: 'black',
  },
  preview: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  capture: {
    flex: 0,
    backgroundColor: '#fff',
    borderRadius: 5,
    padding: 15,
    paddingHorizontal: 20,
    alignSelf: 'center',
    margin: 20,
  },
});
