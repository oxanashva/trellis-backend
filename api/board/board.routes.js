import express from 'express'

import { requireAuth } from '../../middlewares/requireAuth.middleware.js'

import {
    //board
    getBoards,
    getBoardById,
    addBoard,
    updateBoard,
    removeBoard,
    // groups
    addBoardGroup,
    updateBoardGroup,
    removeBoardGroup,
    // tasks
    addBoardTask,
    updateBoardTask,
    removeBoardTask,
    // actions
    addBoardAction,
    updateBoardAction,
    removeBoardAction,
    // labels
    addBoardLabel,
    updateBoardLabel,
    removeBoardLabel,
    // members
    addBoardMember,
    updateBoardMember,
    removeBoardMember,
} from './board.controller.js'

const router = express.Router()

// We can add a middleware for the entire router:
// router.use(requireAuth)

router.get('/', getBoards)
router.get('/:id', getBoardById)
router.post('/', addBoard)
router.put('/:id', updateBoard)
router.delete('/:id', removeBoard)

// groups routes
router.post('/:id/group', addBoardGroup)
router.put('/:id/group/:groupId', updateBoardGroup)
router.delete('/:id/group/:groupId', removeBoardGroup)

// tasks routes
router.post('/:id/task', addBoardTask)
router.put('/:id/task/:taskId', updateBoardTask)
router.delete('/:id/task/:taskId', removeBoardTask)

// actions routes
router.post('/:id/action', addBoardAction)
router.put('/:id/action/:actionId', updateBoardAction)
router.delete('/:id/action/:actionId', removeBoardAction)

// labels routes
router.post('/:id/label', addBoardLabel)
router.put('/:id/label/:labelId', updateBoardLabel)
router.delete('/:id/label/:labelId', removeBoardLabel)

// members routes
router.post('/:id/member', addBoardMember)
router.put('/:id/member/:memberId', updateBoardMember)
router.delete('/:id/member/:memberId', removeBoardMember)

export const boardRoutes = router