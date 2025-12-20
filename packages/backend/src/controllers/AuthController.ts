import { Request, Response } from 'express'
import { body, validationResult } from 'express-validator'
import { AuthService } from '../services/AuthService'
import { AuthUtils } from '../utils/auth'
import { AuthenticatedRequest } from '../middleware/auth'

export class AuthController {
  /**
   * 회원가입 검증 미들웨어
   */
  static validateRegister = [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('유효한 이메일 주소를 입력해주세요'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('비밀번호는 최소 8자 이상이어야 합니다')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])/)
      .withMessage('비밀번호는 대소문자, 숫자, 특수문자를 포함해야 합니다'),
    body('username')
      .optional()
      .isLength({ min: 2, max: 30 })
      .matches(/^[a-zA-Z0-9_\u3131-\u318E\uAC00-\uD7A3]+$/)
      .withMessage('사용자명은 2-30자의 한글, 영문, 숫자, 밑줄만 사용할 수 있습니다'),
  ]

  /**
   * 로그인 검증 미들웨어
   */
  static validateLogin = [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('유효한 이메일 주소를 입력해주세요'),
    body('password')
      .notEmpty()
      .withMessage('비밀번호를 입력해주세요'),
  ]

  /**
   * 회원가입
   */
  static async register(req: Request, res: Response): Promise<void> {
    try {
      // 유효성 검증
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: '입력값이 올바르지 않습니다',
          errors: errors.array(),
        })
        return
      }

      const { email, username, password } = req.body

      const result = await AuthService.register({
        email,
        username,
        password,
      })

      if (!result.success) {
        res.status(400).json({
          success: false,
          message: result.message,
        })
        return
      }

      res.status(201).json({
        success: true,
        message: result.message,
        user: result.user,
        tokens: result.tokens,
      })
    } catch (error) {
      console.error('Register error:', error)
      res.status(500).json({
        success: false,
        message: '서버 오류가 발생했습니다',
      })
    }
  }

  /**
   * 로그인
   */
  static async login(req: Request, res: Response): Promise<void> {
    try {
      // 유효성 검증
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: '입력값이 올바르지 않습니다',
          errors: errors.array(),
        })
        return
      }

      const { email, password } = req.body

      const result = await AuthService.login({
        email,
        password,
      })

      if (!result.success) {
        res.status(401).json({
          success: false,
          message: result.message,
        })
        return
      }

      res.json({
        success: true,
        message: result.message,
        user: result.user,
        tokens: result.tokens,
      })
    } catch (error) {
      console.error('Login error:', error)
      res.status(500).json({
        success: false,
        message: '서버 오류가 발생했습니다',
      })
    }
  }

  /**
   * 토큰 갱신
   */
  static async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body

      if (!refreshToken) {
        res.status(400).json({
          success: false,
          message: '리프레시 토큰이 필요합니다',
        })
        return
      }

      const result = await AuthService.refreshToken(refreshToken)

      if (!result.success) {
        res.status(401).json({
          success: false,
          message: result.message,
        })
        return
      }

      res.json({
        success: true,
        message: result.message,
        tokens: result.tokens,
      })
    } catch (error) {
      console.error('Refresh token error:', error)
      res.status(500).json({
        success: false,
        message: '서버 오류가 발생했습니다',
      })
    }
  }

  /**
   * 프로필 조회
   */
  static async getProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: '인증이 필요합니다',
        })
        return
      }

      const result = await AuthService.getProfile(req.user.id)

      if (!result.success) {
        res.status(404).json({
          success: false,
          message: result.message,
        })
        return
      }

      res.json({
        success: true,
        user: result.user,
      })
    } catch (error) {
      console.error('Get profile error:', error)
      res.status(500).json({
        success: false,
        message: '서버 오류가 발생했습니다',
      })
    }
  }

  /**
   * 프로필 업데이트
   */
  static async updateProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: '인증이 필요합니다',
        })
        return
      }

      const { username, bio, avatar } = req.body

      const result = await AuthService.updateProfile(req.user.id, {
        username,
        bio,
        avatar,
      })

      if (!result.success) {
        res.status(400).json({
          success: false,
          message: result.message,
        })
        return
      }

      res.json({
        success: true,
        message: result.message,
        user: result.user,
      })
    } catch (error) {
      console.error('Update profile error:', error)
      res.status(500).json({
        success: false,
        message: '서버 오류가 발생했습니다',
      })
    }
  }

  /**
   * 비밀번호 변경
   */
  static async changePassword(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: '인증이 필요합니다',
        })
        return
      }

      const { currentPassword, newPassword } = req.body

      if (!currentPassword || !newPassword) {
        res.status(400).json({
          success: false,
          message: '현재 비밀번호와 새 비밀번호를 모두 입력해주세요',
        })
        return
      }

      const result = await AuthService.changePassword(
        req.user.id,
        currentPassword,
        newPassword
      )

      if (!result.success) {
        res.status(400).json({
          success: false,
          message: result.message,
        })
        return
      }

      res.json({
        success: true,
        message: result.message,
      })
    } catch (error) {
      console.error('Change password error:', error)
      res.status(500).json({
        success: false,
        message: '서버 오류가 발생했습니다',
      })
    }
  }

  /**
   * 로그아웃 (클라이언트에서 토큰 삭제)
   */
  static async logout(req: AuthenticatedRequest, res: Response): Promise<void> {
    // 실제 로그아웃은 클라이언트에서 토큰을 삭제하는 것으로 처리
    // 필요한 경우 리프레시 토큰을 블랙리스트에 추가할 수 있음

    res.json({
      success: true,
      message: '로그아웃되었습니다',
    })
  }

  /**
   * 토큰 검증
   */
  static async verifyToken(req: AuthenticatedRequest, res: Response): Promise<void> {
    // 미들웨어에서 이미 토큰을 검증했으므로 사용자 정보만 반환
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: '유효하지 않은 토큰입니다',
      })
      return
    }

    res.json({
      success: true,
      user: req.user,
    })
  }
}
