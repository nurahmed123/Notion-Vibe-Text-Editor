import { useState } from 'react'
import { Editor } from 'notion-vibe-text-editor'
import { MantineProvider } from '@mantine/core'
import '@mantine/core/styles.css'

function App() {
  const [content, setContent] = useState("")

  return (
    <MantineProvider>
      <div style={{ maxWidth: 800, margin: '40px auto', padding: 20 }}>
        <h1 style={{ fontFamily: 'sans-serif' }}>Editor Test</h1>
        <div style={{ border: '1px solid #ccc', borderRadius: 8 }}>
          <Editor 
            initialContent={""}
            onChange={(val) => setContent(val)} 
            showSlug={true} 
            onSlugChange={(s) => console.log('Slug:', s)}
            cloudinaryConfig={{
              apiKey: '865252537442689',
              apiSecret: '19Ml1OPiAb5dPzOFf0s04DfmnMc',
              cloudName: 'drh5f6vui',
              folderName: 'test',
            }}
            aiConfig={{ apiKey: 'ak_2Wa0fm7jm5Ol78G3DN4BK6ba7GW3x' }}
          />
        </div>
        <div style={{ marginTop: 20 }}>
          <h3 style={{ fontFamily: 'sans-serif' }}>Output JSON blocks:</h3>
          <pre style={{ background: '#eee', padding: 10, borderRadius: 4, overflow: 'auto' }}>
            {content}
          </pre>
        </div>
      </div>
    </MantineProvider>
  )
}

export default App
