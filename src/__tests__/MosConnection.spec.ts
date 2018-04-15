import { MosConnection } from '../MosConnection'
import { ConnectionConfig } from '../config/connectionConfig'
import { IMOSConnectionStatus, 
	IMOSDevice,
	IMOSObject,
	IMOSObjectType,
	IMOSObjectStatus,
	IMOSObjectAirStatus,
	IMOSObjectPathType,
	IMOSObjectPath,
	IMOSRunningOrder,
	IMOSROAck,
	IMOSRunningOrderBase,
	IMOSStoryStatus,
	IMOSRunningOrderStatus,
	IMOSItemStatus,
	IMOSROReadyToAir,
	IMOSStoryAction,
	IMOSROStory,
	IMOSItem,
	IMOSItemAction,
	IMOSROAction
} from '../api'
import { MosTime } from '../dataTypes/mosTime'
import { MosString128 } from '../dataTypes/mosString128'
import { Socket, Server } from 'net'

import { SocketMock } from '../__mocks__/socket'
import { ServerMock } from '../__mocks__/server'

import { xmlData, xmlApiData } from './testData.spec'
import * as parser from 'xml2json'
import { MosDevice } from '../MosDevice'

const parseOptions = {
	object: true,
	coerce: true,
	trim: true
}

const iconv = require('iconv-lite')
iconv.encodingExists('utf16-be')

// breaks net.Server, disabled for now
// jest.mock('net')
jest.mock('net')

const literal = <T>(o: T) => o

function getMosDevice (): Promise<IMOSDevice> {
	let mos = new MosConnection({
		mosID: 'aircache.newscenter.com',
		acceptsConnections: true,
		profiles: {
			'0': true,
			'1': true
		}
	})

	return mos.connect({
		primary: {
			id: 'ncs.newscenter.com',
			host: '127.0.0.1',
			timeout: 200
		}
	})
}
let sendMessageId = 1632
function fakeIncomingMessage (socketMockLower, message: string): Promise<number> {
	sendMessageId++
	let fullMessage = getXMLReply(sendMessageId, message)
	socketMockLower.mockReceiveMessage(encode(fullMessage))

	return Promise.resolve(sendMessageId)
}
function getXMLReply (messageId, content): string {
	return '<mos>' +
		'<mosID>aircache.newscenter.com</mosID>' +
		'<ncsID>ncs.newscenter.com</ncsID>' +
		'<messageID>' + messageId + '</messageID>' +
		content +
		'</mos>\r\n'
}
function decode (data: Buffer): string {
	return iconv.decode(data, 'utf16-be')
}
function encode (str: string) {
	return iconv.encode(str, 'utf16-be')
}
function getMosObj (): IMOSObject {
	return {
		ID: new MosString128('abc123'),
		Slug: new MosString128('Just another test'),
		Type: IMOSObjectType.VIDEO,
		TimeBase: 25, // fps
		Revision: 1,
		Duration: 328, // frames,
		Status: IMOSObjectStatus.READY,
		AirStatus: IMOSObjectAirStatus.READY,
		Paths: [{
			Type: IMOSObjectPathType.PATH,
			Description: 'Media path',
			Target: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
		}],
		CreatedBy: new MosString128('R.A'),
		Created: new MosTime(536457600000),
		Description: ''
	}
}
let socketMockLower: SocketMock
let socketMockUpper: SocketMock
let socketMockQuery: SocketMock



beforeAll(() => {
	// Mock tcp connection
	// @ts-ignore Replace Socket with the mocked varaint:
	Socket = SocketMock
	// @ts-ignore Replace Server with the mocked varaint:
	Server = ServerMock
})
beforeEach(() => {
	SocketMock.mockClear()
})

test('Test the Socket mock', async () => {

	let conn = new Socket()

	let onData = jest.fn()
	let onConnect = jest.fn()
	let onClose = jest.fn()
	let onError = jest.fn()

	conn.on('data', onData)
	conn.on('connect', onConnect)
	conn.on('close', onClose)
	conn.on('error', onError)

	conn.connect('127.0.0.1')

	expect(conn.connect).toHaveBeenCalledTimes(1)

	expect(SocketMock.instances).toHaveLength(1)

	let connMock = SocketMock.instances[0]

	// Simulate us getting som data:
	connMock.mockReceiveMessage('hello')

	expect(onData).toHaveBeenCalledTimes(1)

	// Send some data:
	conn.write('hello!')

	expect(connMock.mockSentMessage).toHaveBeenCalledTimes(1)

})

test('basic initialization', async () => {
	let mos = new MosConnection(new ConnectionConfig({
		mosID: 'jestMOS',
		acceptsConnections: false,
		profiles: {
			'0': true,
			'1': true
		}
	}))

	expect(mos.profiles).toMatchObject({
		'0': true,
		'1': true
	})

	// expect(mos.complianceText).toBe('MOS Compatible – Profiles 0,1')
})

test('Incoming connections', async () => {
	let mos = new MosConnection({
		mosID: 'jestMOS',
		acceptsConnections: true,
		profiles: {
			'0': true,
			'1': true
		}
	})
	expect(mos.acceptsConnections).toBe(true)

	// SocketMock.mockAddReply('<hello>')
	await expect(mos.isListening).resolves.toEqual([true, true, true])

	// close sockets after test
	mos.isListening
		.then(() => mos.dispose())
		.catch(() => mos.dispose())
})

describe('MosDevice: Profile 0', () => {
	test('init and connectionStatusChanged', async () => {
		let mos = new MosConnection(new ConnectionConfig({
			mosID: 'jestMOS',
			acceptsConnections: false,
			profiles: {
				'0': true,
				'1': true
			}
		}))

		let mosDevice = await mos.connect({
			primary: {
				id: 'mockServer',
				host: '127.0.0.1',
				timeout: 200
			}
		})

		expect(mosDevice).toBeTruthy()

		expect(SocketMock.instances).toHaveLength(3)
		let connMocks = SocketMock.instances
		// expect(connMocks[0].connect).toHaveBeenCalledTimes(1)
		// expect(connMocks[0].connect.mock.calls[0][0]).toEqual(10540)
		// expect(connMocks[0].connect.mock.calls[0][1]).toEqual('127.0.0.1')
		expect(connMocks[1].connect).toHaveBeenCalledTimes(1)
		expect(connMocks[1].connect.mock.calls[0][0]).toEqual(10540)
		expect(connMocks[1].connect.mock.calls[0][1]).toEqual('127.0.0.1')
		expect(connMocks[2].connect).toHaveBeenCalledTimes(1)
		expect(connMocks[2].connect.mock.calls[0][0]).toEqual(10541)
		expect(connMocks[2].connect.mock.calls[0][1]).toEqual('127.0.0.1')

		let connectionStatusChanged = jest.fn()

		mosDevice.onConnectionChange((connectionStatus: IMOSConnectionStatus) => {
			connectionStatusChanged(connectionStatus)
		})

		// expect(connectionStatusChanged).toHaveBeenCalledTimes(1) // dunno if it really should have been called, maybe remove

		expect(mosDevice.getConnectionStatus()).toMatchObject({
			PrimaryConnected: true,
			PrimaryStatus: '', // if not connected this will contain human-readable error-message
			SecondaryConnected: false
			// SecondaryStatus: string // if not connected this will contain human-readable error-message
		})

		connectionStatusChanged.mockClear()

		// @todo: add timeout test
		// mock cause timeout
		// expect(connectionStatusChanged).toHaveBeenCalledTimes(1)
		// expect(connectionStatusChanged.mock.calls[0][0]).toMatchObject({PrimaryConnected: false})
	})
})

describe('MosDevice: Profile 1', () => {
	let mosDevice
	let socketMock
	let onRequestMOSObject
	let onRequestAllMOSObjects

	beforeAll(async () => {
		SocketMock.mockClear()

		mosDevice = await getMosDevice()

		onRequestMOSObject = jest.fn()
		onRequestAllMOSObjects = jest.fn()

		mosDevice.onRequestMOSObject ((objId: string): Promise<IMOSObject | null> => {
			return onRequestMOSObject(objId)
		})
		mosDevice.onRequestAllMOSObjects ((): Promise<Array<IMOSObject>> => {
			return onRequestAllMOSObjects()
		})
		expect(SocketMock.instances).toHaveLength(3)
		expect(SocketMock.instances[0]).toBeTruthy()
		expect(SocketMock.instances[1]).toBeTruthy()
		expect(SocketMock.instances[2]).toBeTruthy()
	})
	beforeEach(() => {
		// SocketMock.mockClear()
		onRequestMOSObject.mockClear()
		onRequestAllMOSObjects.mockClear()
	})
	test('init', async () => {
		expect(mosDevice).toBeTruthy()
		expect(SocketMock.instances).toHaveLength(1)
	})
	test('onRequestMOSObject', async () => {

		let mosObj = getMosObj()

		onRequestMOSObject.mockReturnValueOnce(Promise.resolve(mosObj))
		// Fake incoming message on socket:
		await fakeIncomingMessage(socketMock, '<mosReqObj><objID>' + mosObj.ID + '</objID></mosReqObj>')

		expect(onRequestMOSObject).toHaveBeenCalledTimes(1)
		expect(onRequestMOSObject.mock.calls[0][0]).toEqual(mosObj.ID)
		expect(onRequestAllMOSObjects).toHaveBeenCalledTimes(0)
	})
	test('onRequestAllMOSObjects', async () => {
		let mosObj = getMosObj()

		expect(socketMock).toBeTruthy()

		// Mock our response
		onRequestAllMOSObjects.mockReturnValueOnce(Promise.resolve([mosObj]))
		// Fake incoming message on socket:
		await fakeIncomingMessage(socketMock, '<mosReqObj><objID>' + mosObj.ID + '</objID></mosReqObj>')

		expect(onRequestAllMOSObjects).toHaveBeenCalledTimes(1)
		expect(onRequestMOSObject).toHaveBeenCalledTimes(0)
		expect(socketMock.mockReceiveMessage).toHaveBeenCalledTimes(1)
		expect(socketMock.mockReceiveMessage.mock.calls[0][0]).toMatch(new RegExp('mosListAll.+mosObj.+<objID>' + mosObj.ID))

		// Test :
		// mosDevice.getMOSObject?: (objId: string) => Promise<IMOSObject>
		// mosDevice.getAllMOSObjects?: () => Promise<Array<IMOSObject>>

	})
	test('getMOSObject', async () => {
		let mosObj = getMosObj()

		// Prepare mock server response:
		let mockReply = jest.fn((data) => {
			let messageID = data.match(/<messageID>([^<]+)<\/messageID>/)[1]
			return getXMLReply(messageID, xmlData.mosObj)

		})
		socketMock.mockAddReply(mockReply)
		let returnedObj: IMOSObject = await mosDevice.getMOSObject(mosObj.ID)

		expect(mockReply).toHaveBeenCalledTimes(1)
		expect(mockReply.mock.calls[0][0]).toMatch(/<mosReqObj>/)

		expect(returnedObj).toMatchObject(xmlApiData.roList)
	})
	// todo: getAllMOSObjects
})

describe('MosDevice: Profile 2', () => {
	let mosDevice: MosDevice
	let socketMockLower: SocketMock
	let socketMockUpper: SocketMock
	let socketMockQuery: SocketMock

	let serverMockLower: ServerMock
	let serverMockUpper: ServerMock
	let serverMockQuery: ServerMock

	let serverSocketMockLower: SocketMock
	let serverSocketMockUpper: SocketMock
	let serverSocketMockQuery: SocketMock

	let onRequestMOSObject
	let onRequestAllMOSObjects
	let onCreateRunningOrder
	let onReplaceRunningOrder
	let onDeleteRunningOrder
	let onRequestRunningOrder
	let onMetadataReplace
	let onRunningOrderStatus
	let onStoryStatus
	let onItemStatus
	let onReadyToAir
	let onROInsertStories
	let onROInsertItems
	let onROReplaceStories
	let onROReplaceItems
	let onROMoveStories
	let onROMoveItems
	let onRODeleteStories
	let onRODeleteItems
	let onROSwapStories
	let onROSwapItems

	async function checkReplyToServer (socket: SocketMock, messageId: number, replyString: string) {
		// check reply to server:
		await socket.mockWaitForSentMessages()

		expect(socket.mockSentMessage).toHaveBeenCalledTimes(1)
		let reply = decode(socket.mockSentMessage.mock.calls[0][0])
		expect(reply).toContain('<messageID>' + messageId + '</messageID>')
		expect(reply).toContain(replyString)
	}

	beforeAll(async () => {
		SocketMock.mockClear()
		ServerMock.mockClear()

		mosDevice = await getMosDevice()

		// Profile 1:
		onRequestMOSObject = jest.fn()
		onRequestAllMOSObjects = jest.fn()

		let roAckReply = () => {
			let ack: IMOSROAck = {
				ID: new MosString128('runningOrderId'),
				Status: new MosString128('OK'),
				Stories: []
			}
			return Promise.resolve(ack)
		}
		// Profile 2:
		onCreateRunningOrder = jest.fn(roAckReply)
		onReplaceRunningOrder = jest.fn(roAckReply)
		onDeleteRunningOrder = jest.fn(roAckReply)
		onRequestRunningOrder = jest.fn(() => {
			return Promise.resolve(xmlApiData.roCreate)
		})
		onMetadataReplace = jest.fn(roAckReply)
		onRunningOrderStatus = jest.fn(roAckReply)
		onStoryStatus = jest.fn(roAckReply)
		onItemStatus = jest.fn(roAckReply)
		onReadyToAir = jest.fn(roAckReply)
		onROInsertStories = jest.fn(roAckReply)
		onROInsertItems = jest.fn(roAckReply)
		onROReplaceStories = jest.fn(roAckReply)
		onROReplaceItems = jest.fn(roAckReply)
		onROMoveStories = jest.fn(roAckReply)
		onROMoveItems = jest.fn(roAckReply)
		onRODeleteStories = jest.fn(roAckReply)
		onRODeleteItems = jest.fn(roAckReply)
		onROSwapStories = jest.fn(roAckReply)
		onROSwapItems = jest.fn(roAckReply)

		mosDevice.onRequestMOSObject ((objId: string): Promise<IMOSObject | null> => {
			return onRequestMOSObject(objId)
		})
		mosDevice.onRequestAllMOSObjects ((): Promise<Array<IMOSObject>> => {
			return onRequestAllMOSObjects()
		})
		mosDevice.onCreateRunningOrder ((ro: IMOSRunningOrder): Promise<IMOSROAck> => {
			return onCreateRunningOrder(ro)
		})
		mosDevice.onReplaceRunningOrder ((ro: IMOSRunningOrder): Promise<IMOSROAck> => {
			return onReplaceRunningOrder(ro)
		})
		mosDevice.onDeleteRunningOrder ((runningOrderId: MosString128): Promise<IMOSROAck> => {
			return onDeleteRunningOrder(runningOrderId)
		})
		mosDevice.onRequestRunningOrder ((runningOrderId: MosString128): Promise<IMOSRunningOrder | null> => {
			return onRequestRunningOrder(runningOrderId)
		})
		mosDevice.onMetadataReplace ((metadata: IMOSRunningOrderBase): Promise<IMOSROAck> => {
			return onMetadataReplace(metadata)
		})
		mosDevice.onRunningOrderStatus ((status: IMOSRunningOrderStatus): Promise<IMOSROAck> => {
			return onRunningOrderStatus(status)
		})
		mosDevice.onStoryStatus ((status: IMOSStoryStatus): Promise<IMOSROAck> => {
			return onStoryStatus(status)
		})
		mosDevice.onItemStatus ((status: IMOSItemStatus): Promise<IMOSROAck> => {
			return onItemStatus(status)
		})
		mosDevice.onReadyToAir ((Action: IMOSROReadyToAir): Promise<IMOSROAck> => {
			return onReadyToAir(Action)
		})
		mosDevice.onROInsertStories ((Action: IMOSStoryAction, Stories: Array<IMOSROStory>): IMOSROAck => {
			return onROInsertStories(Action, Stories)
		})
		mosDevice.onROInsertItems ((Action: IMOSItemAction, Items: Array<IMOSItem>): IMOSROAck => {
			return onROInsertItems(Action, Items)
		})
		mosDevice.onROReplaceStories ((Action: IMOSStoryAction, Stories: Array<IMOSROStory>): IMOSROAck => {
			return onROReplaceStories(Action, Stories)
		})
		mosDevice.onROReplaceItems ((Action: IMOSItemAction, Items: Array<IMOSItem>): IMOSROAck => {
			return onROReplaceItems(Action, Items)
		})
		mosDevice.onROMoveStories ((Action: IMOSStoryAction, Stories: Array<MosString128>): IMOSROAck => {
			return onROMoveStories(Action, Stories)
		})
		mosDevice.onROMoveItems ((Action: IMOSItemAction, Items: Array<MosString128>): IMOSROAck => {
			return onROMoveItems(Action, Items)
		})
		mosDevice.onRODeleteStories ((Action: IMOSROAction, Stories: Array<MosString128>): IMOSROAck => {
			return onRODeleteStories(Action, Stories)
		})
		mosDevice.onRODeleteItems ((Action: IMOSStoryAction, Items: Array<MosString128>): IMOSROAck => {
			return onRODeleteItems(Action, Items)
		})
		mosDevice.onROSwapStories ((Action: IMOSROAction, StoryID0: MosString128, StoryID1: MosString128): IMOSROAck => {
			return onROSwapStories(Action, StoryID0, StoryID1)
		})
		mosDevice.onROSwapItems ((Action: IMOSStoryAction, ItemID0: MosString128, ItemID1: MosString128): IMOSROAck => {
			return onROSwapItems(Action, ItemID0, ItemID1)
		})

		expect(SocketMock.instances).toHaveLength(3)

		SocketMock.instances.forEach((s) => {
			if (s.connectedPort === 10540) socketMockLower = s
			if (s.connectedPort === 10541) socketMockUpper = s
			if (s.connectedPort === 10542) socketMockQuery = s
		})
		expect(socketMockLower).toBeTruthy()
		expect(socketMockUpper).toBeTruthy()
		// expect(socketMockQuery).toBeTruthy()

		expect(ServerMock.instances).toHaveLength(3)
		// ServerMock.instances.forEach((s) => {
		// })
		serverMockLower = ServerMock.instances[0]
		serverMockUpper = ServerMock.instances[2]
		serverMockQuery = ServerMock.instances[1]
		expect(serverMockLower).toBeTruthy()
		expect(serverMockUpper).toBeTruthy()
		expect(serverMockQuery).toBeTruthy()

		// Pretend a server connects to us:
		serverSocketMockLower = serverMockLower.mockNewConnection()
		serverSocketMockUpper = serverMockUpper.mockNewConnection()
		serverSocketMockQuery = serverMockQuery.mockNewConnection()

		socketMockLower.name = 'lower'
		socketMockUpper.name = 'upper'
		// socketMockQuery.name = 'query'

		serverSocketMockLower.name = 'serverLower'
		serverSocketMockUpper.name = 'serverUpper'
		serverSocketMockQuery.name = 'serverQuery'

		// expect(SocketMock.instances[0].connect).toHaveBeenCalledTimes(1)
	})
	beforeEach(() => {
		onRequestMOSObject.mockClear()
		onRequestAllMOSObjects.mockClear()

		onCreateRunningOrder.mockClear()
		onReplaceRunningOrder.mockClear()
		onDeleteRunningOrder.mockClear()
		onRequestRunningOrder.mockClear()
		onMetadataReplace.mockClear()
		onRunningOrderStatus.mockClear()
		onStoryStatus.mockClear()
		onItemStatus.mockClear()
		onReadyToAir.mockClear()
		onROInsertStories.mockClear()
		onROInsertItems.mockClear()
		onROReplaceStories.mockClear()
		onROReplaceItems.mockClear()
		onROMoveStories.mockClear()
		onROMoveItems.mockClear()
		onRODeleteStories.mockClear()
		onRODeleteItems.mockClear()
		onROSwapStories.mockClear()
		onROSwapItems.mockClear()

		serverSocketMockLower.mockClear()
		serverSocketMockUpper.mockClear()
		serverSocketMockQuery.mockClear()

	})
	test('init', async () => {
		expect(mosDevice).toBeTruthy()
		expect(SocketMock.instances).toHaveLength(1)
	})
	test('onCreateRunningOrder', async () => {
		// Fake incoming message on socket:

		let messageId = await fakeIncomingMessage(serverSocketMockLower, xmlData.roCreate)
		expect(onCreateRunningOrder).toHaveBeenCalledTimes(1)
		expect(onCreateRunningOrder.mock.calls[0][0]).toMatchObject(xmlApiData.roCreate)
		await checkReplyToServer(serverSocketMockLower, messageId, '<roAck>')
	})
	test('onReplaceRunningOrder', async () => {
		// Fake incoming message on socket:
		let messageId = await fakeIncomingMessage(serverSocketMockLower, xmlData.roReplace)
		expect(onReplaceRunningOrder).toHaveBeenCalledTimes(1)
		expect(onReplaceRunningOrder.mock.calls[0][0]).toMatchObject(xmlApiData.roReplace)
		await checkReplyToServer(serverSocketMockLower, messageId, '<roAck>')
	})
	test('onDeleteRunningOrder', async () => {
		// Fake incoming message on socket:
		let messageId = await fakeIncomingMessage(serverSocketMockLower, xmlData.roDelete)
		expect(onDeleteRunningOrder).toHaveBeenCalledTimes(1)
		expect(onDeleteRunningOrder.mock.calls[0][0]).toEqual(xmlApiData.roDelete)
		await checkReplyToServer(serverSocketMockLower, messageId, '<roAck>')
	})
	test('onRequestRunningOrder', async () => {
		// Fake incoming message on socket:
		let messageId = await fakeIncomingMessage(serverSocketMockUpper, xmlData.roReq)
		expect(onRequestRunningOrder).toHaveBeenCalledTimes(1)

		expect(onRequestRunningOrder.mock.calls[0][0]).toEqual(96857485)
		// Check reply to socket server:
		await serverSocketMockUpper.mockWaitForSentMessages()
		expect(serverSocketMockUpper.mockSentMessage).toHaveBeenCalledTimes(1)
		await checkReplyToServer(serverSocketMockUpper, messageId, '<roList>')
		// console.log(decode(serverSocketMockUpper.mockSentMessage.mock.calls[0][0]))

		let reply = decode(serverSocketMockUpper.mockSentMessage.mock.calls[0][0])
		let parsedReply = parser.toJson(reply, parseOptions)
		// console.log('parsedReply',parsedReply.mos)

		// expect(parsedReply.mos.roList).toMatchObject(roLight(xmlApiData.roCreate))
		expect(parsedReply.mos.roList.roID + '').toEqual (xmlApiData.roCreate.ID.toString())
		expect(parsedReply.mos.roList.roSlug + '').toEqual (xmlApiData.roCreate.Slug.toString())
		expect(parsedReply.mos.roList.story).toHaveLength(xmlApiData.roCreate.Stories.length)
		expect(parsedReply.mos.roList.story[0].storyID + '').toEqual(xmlApiData.roCreate.Stories[0].ID.toString())
		expect(parsedReply.mos.roList.story[0].item).toBeTruthy()
		expect(parsedReply.mos.roList.story[0].item.itemID + '').toEqual(xmlApiData.roCreate.Stories[0].Items[0].ID.toString())
		expect(parsedReply.mos.roList.story[0].item.objID + '').toEqual(xmlApiData.roCreate.Stories[0].Items[0].ObjectID.toString())

	})
	test('getRunningOrder', async () => {

		// Prepare server response
		let mockReply = jest.fn((data) => {
			// console.log('mockReply', data)
			let str = decode(data)
			let messageID = str.match(/<messageID>([^<]+)<\/messageID>/)[1]
			let repl = getXMLReply(messageID, xmlData.roList)
			// console.log('repl', repl)
			return encode(repl)

		})
		socketMockUpper.mockAddReply(mockReply)
		let returnedObj: IMOSRunningOrder = await mosDevice.getRunningOrder(xmlApiData.roList.ID)
		await socketMockUpper.mockWaitForSentMessages()
		expect(mockReply).toHaveBeenCalledTimes(1)
		let msg = decode(mockReply.mock.calls[0][0])
		expect(msg).toMatch(/<roReq>/)
		expect(returnedObj).toMatchObject(xmlApiData.roList2)
	})
	test('onMetadataReplace', async () => {
		// Fake incoming message on socket:
		let messageId = await fakeIncomingMessage(serverSocketMockLower, xmlData.roMetadataReplace)
		expect(onMetadataReplace).toHaveBeenCalledTimes(1)
		expect(onMetadataReplace.mock.calls[0][0]).toEqual(xmlApiData.roMetadataReplace)
		await checkReplyToServer(serverSocketMockLower, messageId, '<roAck>')
	})
	test('onRunningOrderStatus', async () => {
		// Fake incoming message on socket:
		let messageId = await fakeIncomingMessage(serverSocketMockLower, xmlData.roElementStat_ro)
		expect(onRunningOrderStatus).toHaveBeenCalledTimes(1)
		expect(onRunningOrderStatus.mock.calls[0][0]).toEqual(xmlApiData.roElementStat_ro)
		await checkReplyToServer(serverSocketMockLower, messageId, '<roAck>')
	})
	test('onStoryStatus', async () => {
		// Fake incoming message on socket:
		let messageId = await fakeIncomingMessage(serverSocketMockLower, xmlData.roElementStat_story)
		expect(onStoryStatus).toHaveBeenCalledTimes(1)
		expect(onStoryStatus.mock.calls[0][0]).toEqual(xmlApiData.roElementStat_story)
		await checkReplyToServer(serverSocketMockLower, messageId, '<roAck>')
	})
	test('onItemStatus', async () => {
		// Fake incoming message on socket:
		let messageId = await fakeIncomingMessage(serverSocketMockLower, xmlData.roElementStat_item)
		expect(onItemStatus).toHaveBeenCalledTimes(1)
		expect(onItemStatus.mock.calls[0][0]).toEqual(xmlApiData.roElementStat_item)
		await checkReplyToServer(serverSocketMockLower, messageId, '<roAck>')
	})
	test('setRunningOrderStatus', async () => {
		// Prepare server response
		let mockReply = jest.fn((data) => {
			let messageID = data.match(/<messageID>([^<]+)<\/messageID>/)[1]
			return getXMLReply(messageID, xmlData.roAck)
		})
		socketMockLower.mockAddReply(mockReply)
		let returnedAck: IMOSObject = await mosDevice.setRunningOrderStatus(xmlApiData.roElementStat_ro)
		await socketMockLower.mockWaitForSentMessages()
		expect(mockReply).toHaveBeenCalledTimes(1)
		expect(mockReply.mock.calls[0][0]).toMatch(/<roElementStat element="RO">/)
	})
	test('setStoryStatus', async () => {
		// Prepare server response
		let mockReply = jest.fn((data) => {
			let messageID = data.match(/<messageID>([^<]+)<\/messageID>/)[1]
			return getXMLReply(messageID, xmlData.roAck)
		})
		socketMockLower.mockAddReply(mockReply)
		let returnedAck: IMOSObject = await mosDevice.setStoryStatus(xmlApiData.roElementStat_story)
		await socketMockLower.mockWaitForSentMessages()
		expect(mockReply).toHaveBeenCalledTimes(1)
		expect(mockReply.mock.calls[0][0]).toMatch(/<roElementStat element="STORY">/)
	})
	test('setItemStatus', async () => {
		// Prepare server response
		let mockReply = jest.fn((data) => {
			let messageID = data.match(/<messageID>([^<]+)<\/messageID>/)[1]
			return getXMLReply(messageID, xmlData.roAck)
		})
		socketMockLower.mockAddReply(mockReply)
		let returnedAck: IMOSObject = await mosDevice.setItemStatus(xmlApiData.roElementStat_item)
		await socketMockLower.mockWaitForSentMessages()
		expect(mockReply).toHaveBeenCalledTimes(1)
		expect(mockReply.mock.calls[0][0]).toMatch(/<roElementStat element="ITEM">/)
	})
	test('onReadyToAir', async () => {
		// Fake incoming message on socket:
		let messageId = await fakeIncomingMessage(serverSocketMockLower, xmlData.roReadyToAir)
		expect(onReadyToAir).toHaveBeenCalledTimes(1)
		expect(onReadyToAir.mock.calls[0][0]).toEqual(xmlApiData.roReadyToAir)
		await checkReplyToServer(serverSocketMockLower, messageId, '<roAck>')
	})
	test('onROInsertStories', async () => {
		// Fake incoming message on socket:
		let messageId = await fakeIncomingMessage(serverSocketMockLower, xmlData.roElementAction_insert_story)
		expect(onROInsertStories).toHaveBeenCalledTimes(1)
		expect(onROInsertStories.mock.calls[0][0]).toEqual(xmlApiData.roElementAction_insert_story_Action)
		expect(onROInsertStories.mock.calls[0][1]).toEqual(xmlApiData.roElementAction_insert_story_Stories)
		await checkReplyToServer(serverSocketMockLower, messageId, '<roAck>')
	})
	test('onROInsertItems', async () => {
		// Fake incoming message on socket:
		let messageId = await fakeIncomingMessage(serverSocketMockLower, xmlData.roElementAction_insert_item)
		expect(onROInsertItems).toHaveBeenCalledTimes(1)
		expect(onROInsertItems.mock.calls[0][0]).toEqual(xmlApiData.roElementAction_insert_item_Action)
		expect(onROInsertItems.mock.calls[0][1]).toEqual(xmlApiData.roElementAction_insert_item_Items)
		await checkReplyToServer(serverSocketMockLower, messageId, '<roAck>')
	})
	test('onROReplaceStories', async () => {
		// Fake incoming message on socket:
		let messageId = await fakeIncomingMessage(serverSocketMockLower, xmlData.roElementAction_replace_story)
		expect(onROReplaceStories).toHaveBeenCalledTimes(1)
		expect(onROReplaceStories.mock.calls[0][0]).toEqual(xmlApiData.roElementAction_replace_story_Action)
		expect(onROReplaceStories.mock.calls[0][1]).toEqual(xmlApiData.roElementAction_replace_story_Stories)
		await checkReplyToServer(serverSocketMockLower, messageId, '<roAck>')
	})
	test('onROReplaceItems', async () => {
		// Fake incoming message on socket:
		let messageId = await fakeIncomingMessage(serverSocketMockLower, xmlData.roElementAction_replace_item)
		expect(onROReplaceItems).toHaveBeenCalledTimes(1)
		expect(onROReplaceItems.mock.calls[0][0]).toEqual(xmlApiData.roElementAction_replace_item_Action)
		expect(onROReplaceItems.mock.calls[0][1]).toEqual(xmlApiData.roElementAction_replace_item_Items)
		await checkReplyToServer(serverSocketMockLower, messageId, '<roAck>')
	})
	test('onROMoveStory', async () => {
		// Fake incoming message on socket:
		let messageId = await fakeIncomingMessage(serverSocketMockLower, xmlData.roElementAction_move_story)
		expect(onROMoveStories).toHaveBeenCalledTimes(1)
		expect(onROMoveStories.mock.calls[0][0]).toEqual(xmlApiData.roElementAction_move_story_Action)
		expect(onROMoveStories.mock.calls[0][1]).toEqual(xmlApiData.roElementAction_move_story_Stories)
		await checkReplyToServer(serverSocketMockLower, messageId, '<roAck>')
	})
	test('onROMoveStories', async () => {
		// Fake incoming message on socket:
		let messageId2 = await fakeIncomingMessage(serverSocketMockLower, xmlData.roElementAction_move_stories)
		expect(onROMoveStories).toHaveBeenCalledTimes(1)
		expect(onROMoveStories.mock.calls[0][0]).toEqual(xmlApiData.roElementAction_move_stories_Action)
		expect(onROMoveStories.mock.calls[0][1]).toEqual(xmlApiData.roElementAction_move_stories_Stories)
		await checkReplyToServer(serverSocketMockLower, messageId2, '<roAck>')
	})
	test('onROMoveItems', async () => {
		// Fake incoming message on socket:
		let messageId = await fakeIncomingMessage(serverSocketMockLower, xmlData.roElementAction_move_items)
		expect(onROMoveItems).toHaveBeenCalledTimes(1)
		expect(onROMoveItems.mock.calls[0][0]).toEqual(xmlApiData.roElementAction_move_items_Action)
		expect(onROMoveItems.mock.calls[0][1]).toEqual(xmlApiData.roElementAction_move_items_Items)
		await checkReplyToServer(serverSocketMockLower, messageId, '<roAck>')
	})
	test('onRODeleteStories', async () => {
		// Fake incoming message on socket:
		let messageId = await fakeIncomingMessage(serverSocketMockLower, xmlData.roElementAction_delete_story)
		expect(onRODeleteStories).toHaveBeenCalledTimes(1)
		expect(onRODeleteStories.mock.calls[0][0]).toEqual(xmlApiData.roElementAction_delete_story_Action)
		expect(onRODeleteStories.mock.calls[0][1]).toEqual(xmlApiData.roElementAction_delete_story_Stories)
		await checkReplyToServer(serverSocketMockLower, messageId, '<roAck>')
	})
	test('onRODeleteItems', async () => {
		// Fake incoming message on socket:
		let messageId = await fakeIncomingMessage(serverSocketMockLower, xmlData.roElementAction_delete_items)
		expect(onRODeleteItems).toHaveBeenCalledTimes(1)
		expect(onRODeleteItems.mock.calls[0][0]).toEqual(xmlApiData.roElementAction_delete_items_Action)
		expect(onRODeleteItems.mock.calls[0][1]).toEqual(xmlApiData.roElementAction_delete_items_Items)
		await checkReplyToServer(serverSocketMockLower, messageId, '<roAck>')
	})
	test('onROSwapStories', async () => {
		// Fake incoming message on socket:
		let messageId = await fakeIncomingMessage(serverSocketMockLower, xmlData.roElementAction_swap_stories)
		expect(onROSwapStories).toHaveBeenCalledTimes(1)
		expect(onROSwapStories.mock.calls[0][0]).toEqual(xmlApiData.roElementAction_swap_stories_Action)
		expect(onROSwapStories.mock.calls[0][1]).toEqual(xmlApiData.roElementAction_swap_stories_StoryId0)
		expect(onROSwapStories.mock.calls[0][2]).toEqual(xmlApiData.roElementAction_swap_stories_StoryId1)
		await checkReplyToServer(serverSocketMockLower, messageId, '<roAck>')
	})
	test('onROSwapItems', async () => {
		// Fake incoming message on socket:
		let messageId = await fakeIncomingMessage(serverSocketMockLower, xmlData.roElementAction_swap_items)
		expect(onROSwapItems).toHaveBeenCalledTimes(1)
		expect(onROSwapItems.mock.calls[0][0]).toEqual(xmlApiData.roElementAction_swap_items_Action)
		expect(onROSwapItems.mock.calls[0][1]).toEqual(xmlApiData.roElementAction_swap_items_ItemId0)
		expect(onROSwapItems.mock.calls[0][2]).toEqual(xmlApiData.roElementAction_swap_items_ItemId1)
		await checkReplyToServer(serverSocketMockLower, messageId, '<roAck>')
	})
})
