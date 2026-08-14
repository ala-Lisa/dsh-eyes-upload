window.__ModuleLoader__.load({
  id: 'dsh-eyes-upload',
  factory: function (require) {
    var React = require('react')

    function reportError(err, info) {
      try {
        fetch('/api/eyes-report', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            error: String(err && err.message ? err.message : err),
            stack: String(err && err.stack ? err.stack : '').slice(0, 2000),
            info: String(info || ''),
            href: typeof location !== 'undefined' ? location.href : '',
            at: new Date().toISOString(),
          }),
        }).catch(function () {})
      } catch (e) { /* ignore */ }
      if (typeof console !== 'undefined' && console.error) {
        console.error('dsh-eyes-upload:', err, info)
      }
    }

    function toBase64(file) {
      return new Promise(function (resolve, reject) {
        var reader = new FileReader()
        reader.onload = function () {
          var dataUrl = String(reader.result)
          var comma = dataUrl.indexOf(',')
          resolve(comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl)
        }
        reader.onerror = function () { reject(new Error('读取文件失败')) }
        reader.readAsDataURL(file)
      })
    }

    function analyzeFile(file, sessionId) {
      return toBase64(file).then(function (base64) {
        return fetch('/api/eyes-upload', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: file.name, data: base64, sessionId: sessionId }),
        }).then(function (res) { return res.json() })
      })
    }

    function removeUpload(sessionId, id) {
      return fetch('/api/eyes-remove', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId: sessionId, id: id }),
      }).then(function (res) { return res.json() })
    }

    function ensureStyle() {
      try {
        if (typeof document === 'undefined') return
        if (document.getElementById('dsh-eyes-upload-style')) return
        var st = document.createElement('style')
        st.id = 'dsh-eyes-upload-style'
        st.textContent = '@keyframes eyes-upload-spin{to{transform:rotate(360deg)}}.dsh-eyes-upload-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)!important}.dsh-eyes-upload-x:hover{background:var(--dsw-alias-interactive-bg-hover)}'
        document.head.appendChild(st)
      } catch (e) { /* ignore */ }
    }

    function UploadButtonInner(props) {
      var sessionId = props.sessionId
      var fileRef = React.useRef(null)
      // { phase: idle|busy|error, current, total, name }
      var state = React.useState({ phase: 'idle', current: 0, total: 0, name: '' })
      var st = state[0]
      var setSt = state[1]
      var phase = st.phase
      var err = React.useState(null)
      var errorText = err[0]
      var setErrorText = err[1]
      // 已上传的挂起列表:[{ id, name }] 按上传顺序排列
      var up = React.useState([])
      var uploadList = up[0]
      var setUploadList = up[1]
      var busyRef = React.useRef(false)
      busyRef.current = phase === 'busy'

      function handleFiles(files) {
        if (busyRef.current) return
        var images = []
        for (var i = 0; i < files.length; i++) {
          var f = files[i]
          if (f && typeof f.type === 'string' && f.type.indexOf('image/') === 0) images.push(f)
        }
        if (images.length === 0) return
        setSt({ phase: 'busy', current: 0, total: images.length, name: images[0].name })
        setErrorText(null)
        var results = []
        var chain = Promise.resolve()
        for (var j = 0; j < images.length; j++) {
          ;(function (file, idx) {
            chain = chain.then(function () {
              setSt({ phase: 'busy', current: idx, total: images.length, name: file.name })
              return analyzeFile(file, sessionId).then(function (json) {
                if (!json.ok) throw new Error(json.error || '上传失败')
                results.push({ id: json.id, name: json.name })
              })
            })
          })(images[j], j)
        }
        chain
          .then(function () {
            setUploadList(function (prev) { return prev.concat(results) })
            setSt({ phase: 'idle', current: 0, total: 0, name: '' })
          })
          .catch(function (error) {
            setErrorText(String(error && error.message ? error.message : error))
            reportError(error, 'upload')
            setSt({ phase: 'error', current: 0, total: 0, name: '' })
            setTimeout(function () { setSt({ phase: 'idle', current: 0, total: 0, name: '' }) }, 6000)
          })
      }

      var onChange = function (e) {
        var target = e.target
        var fileList = target && target.files ? Array.prototype.slice.call(target.files) : []
        if (target) target.value = ''
        handleFiles(fileList)
      }

      React.useEffect(function () {
        function onPaste(e) {
          var cd = e.clipboardData
          if (!cd || !cd.items) return
          var files = []
          for (var i = 0; i < cd.items.length; i++) {
            var it = cd.items[i]
            if (it.kind === 'file') {
              var f = it.getAsFile()
              if (f) files.push(f)
            }
          }
          if (files.length === 0) return
          e.preventDefault()
          e.stopPropagation()
          handleFiles(files)
        }
        window.addEventListener('paste', onPaste, true)
        return function () { window.removeEventListener('paste', onPaste, true) }
      }, [sessionId])

      // 用户把消息发出后(提交完成、草稿清空),自动清空挂起列表
      var input = props.input
      var prevPhaseRef = React.useRef(input ? input.phase : 'plain')
      React.useEffect(function () {
        if (!input) return
        var p = input.phase
        var wasSubmitting = prevPhaseRef.current === 'submitting' || prevPhaseRef.current === 'claimed'
        if (wasSubmitting && p === 'plain' && String(input.draft || '').trim() === '') {
          setUploadList(function (prev) { return prev.length > 0 ? [] : prev })
        }
        prevPhaseRef.current = p
      }, [input])

      var busy = phase === 'busy'
      var baseStyle = {
        minWidth: 0,
        maxWidth: '220px',
        height: '28px',
        color: 'var(--dsw-alias-label-secondary)',
        cursor: busy ? 'wait' : 'pointer',
        background: 'transparent',
        border: 'none',
        borderRadius: '24px',
        outline: 'none',
        alignItems: 'center',
        gap: '4px',
        padding: '0 8px',
        fontSize: '13px',
        fontWeight: 500,
        lineHeight: '20px',
        display: 'inline-flex',
        flex: 'none',
        opacity: busy ? 0.85 : 1,
      }
      var iconSvg = React.createElement(
        'svg',
        { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
        React.createElement('rect', { x: 3, y: 3, width: 18, height: 18, rx: 2.5 }),
        React.createElement('circle', { cx: 9, cy: 9, r: 2 }),
        React.createElement('path', { d: 'm21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21' }),
      )
      var spinSvg = React.createElement(
        'svg',
        { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', style: { animation: 'eyes-upload-spin 0.9s linear infinite' }, 'aria-hidden': true },
        React.createElement('circle', { cx: 12, cy: 12, r: 9, stroke: 'currentColor', strokeWidth: 3, strokeLinecap: 'round', strokeDasharray: '42 60', fill: 'none', opacity: 0.9 }),
      )

      var label
      var title
      if (busy) {
        label = (st.total > 1 ? st.current + 1 + '/' + st.total + ' ' : '') + '分析中…'
        title = '正在分析第 ' + (st.current + 1) + ' 张(共 ' + st.total + ' 张): ' + st.name
      } else if (phase === 'error') {
        label = '上传失败'
        title = errorText !== null ? errorText : '上传失败'
      } else {
        label = '传图'
        title = errorText !== null ? errorText : '上传图片或直接 Ctrl+V 粘贴截图(可多张,不限数量);分析后右侧「已传 N 张」胶囊可查看/删除,你下一条消息会自动附带分析'
      }

      var chipStyle = {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        height: '28px',
        flex: 'none',
        padding: '0 8px',
        borderRadius: '24px',
        border: 'none',
        background: 'transparent',
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: '13px',
        fontWeight: 500,
        lineHeight: '20px',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        outline: 'none',
      }
      var listOpen = React.useState(false)
      var listVisible = listOpen[0]
      var setListVisible = listOpen[1]

      var queue = null
      if (uploadList.length > 0) {
        var panelStyle = {
          position: 'absolute',
          bottom: '100%',
          left: '0',
          minWidth: 'min(260px, 80vw)',
          maxWidth: 'min(420px, 80vw)',
          maxHeight: '260px',
          overflowY: 'auto',
          background: 'var(--dsw-specific-menu)',
          color: 'var(--dsw-alias-label-primary)',
          border: '1px solid var(--dsw-alias-border-inverted)',
          boxShadow: 'var(--dsw-shadow-lv3)',
          borderRadius: '12px',
          padding: '4px',
          zIndex: 2147483000,
          flexDirection: 'column',
          display: 'flex',
        }
        var rowStyle = {
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '5px 8px',
          borderRadius: '6px',
          fontSize: '13px',
        }
        var rowXStyle = {
          border: 'none',
          background: 'transparent',
          color: 'var(--dsw-alias-label-secondary)',
          cursor: 'pointer',
          padding: '0 4px',
          fontSize: '12px',
          lineHeight: 1,
          marginLeft: 'auto',
          borderRadius: '50%',
          flex: 'none',
        }
        queue = React.createElement(
          'span',
          {
            style: { position: 'relative', display: 'inline-flex', flex: 'none' },
            onMouseEnter: function () { setListVisible(true) },
            onMouseLeave: function () { setListVisible(false) },
          },
          React.createElement(
            'button',
            {
              type: 'button',
              className: 'dsh-eyes-upload-btn',
              style: chipStyle,
              title: '已上传 ' + uploadList.length + ' 张,悬停查看/删除',
            },
            '已传 ' + uploadList.length + ' 张',
          ),
          React.createElement(
            'div',
            {
              style: {
                ...panelStyle,
                opacity: listVisible ? 1 : 0,
                visibility: listVisible ? 'visible' : 'hidden',
                transition: 'opacity 0.25s ease, visibility 0.25s ease',
                pointerEvents: listVisible ? 'auto' : 'none',
              },
            },
            uploadList.map(function (u, i) {
              return React.createElement(
                'div',
                {
                  key: u.id,
                  style: rowStyle,
                  title: '第 ' + (i + 1) + ' 张: ' + u.name,
                },
                React.createElement(
                  'span',
                  { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
                  (i + 1) + '. ' + u.name,
                ),
                React.createElement(
                  'button',
                  {
                    type: 'button',
                    className: 'dsh-eyes-upload-x',
                    style: rowXStyle,
                    title: '删除这张图片(不会随消息附带)',
                    onClick: function () {
                      removeUpload(sessionId, u.id)
                        .then(function (json) {
                          if (json.ok) {
                            setUploadList(function (prev) {
                              return prev.filter(function (x) { return x.id !== u.id })
                            })
                          }
                        })
                        .catch(function () {})
                    },
                  },
                  '✕',
                ),
              )
            }),
          ),
        )
      }

      return React.createElement(
        React.Fragment,
        null,
        React.createElement('input', {
          type: 'file',
          multiple: true,
          accept: 'image/png,image/jpeg,image/webp,image/gif,image/bmp',
          style: { display: 'none' },
          ref: fileRef,
          onChange: onChange,
        }),
        React.createElement(
          'button',
          { type: 'button', className: 'dsh-eyes-upload-btn', title: title, style: baseStyle, onClick: function () { if (!busy && fileRef.current) fileRef.current.click() } },
          busy ? spinSvg : iconSvg,
          React.createElement('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, label),
        ),
        queue,
      )
    }

    // 错误边界:渲染崩溃时在按钮位置显示原因,并把错误上报给主机诊断通道。
    class UploadButtonBoundary extends React.Component {
      constructor(props) {
        super(props)
        this.state = { error: null }
      }
      static getDerivedStateFromError(error) {
        return { error: error }
      }
      componentDidCatch(error, info) {
        reportError(error, info && info.componentStack ? info.componentStack.slice(0, 800) : '')
      }
      render() {
        if (this.state.error) {
          var err = this.state.error
          var msg = String(err && err.message ? err.message : err)
          var stackLine = ''
          if (err && typeof err.stack === 'string') {
            var lines = err.stack.split('\n')
            for (var i = 0; i < lines.length; i++) {
              var line = lines[i].trim()
              if (line.indexOf('dsh-eyes-upload') >= 0) { stackLine = line; break }
            }
          }
          var full = stackLine !== '' ? msg + ' | ' + stackLine : msg
          return React.createElement(
            'button',
            {
              type: 'button',
              title: full,
              style: {
                height: 'auto',
                maxWidth: '320px',
                padding: '4px 8px',
                borderRadius: '6px',
                border: '1px solid rgba(220,80,80,0.6)',
                background: 'transparent',
                color: 'inherit',
                fontSize: '11px',
                cursor: 'help',
                whiteSpace: 'normal',
                textAlign: 'left',
              },
            },
            '🖼 传图出错: ' + msg.slice(0, 90) + (stackLine !== '' ? '\n' + stackLine.slice(0, 160) : ''),
          )
        }
        return React.createElement(UploadButtonInner, this.props)
      }
    }

    return {
      inject: ['slots'],
      apply: function (ctx) {
        ensureStyle()
        ctx.slots.inject('conversation.input.left', function () {
          return ctx.slots.register(
            { name: 'conversation.input.left', id: 'eyes-upload', order: 20, label: '上传图片' },
            UploadButtonBoundary,
          )
        })
      },
    }
  },
})
