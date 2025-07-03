import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Button,
} from "react-native";

const BOARD_API =
  "https://script.google.com/macros/s/AKfycbwifQqB1ds_31qF3-XuZhPNA3fv_fCsWXR2z8G-dIlk-ENZIpwQBxjCWZOtZkJ0ATRk/exec?action=listBoards";

export default function App() {
  const [boards, setBoards] = useState([]);
  const [selectedBoard, setSelectedBoard] = useState(null);
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);

  // 1. 보드 리스트 불러오기
  useEffect(() => {
    fetch(BOARD_API)
      .then((res) => res.json())
      .then((data) => {
        setBoards(
          data.filter((b) => b.webappUrl && b.webappUrl.startsWith("http"))
        );
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // 2. 보드 선택 시, 해당 보드의 문서 리스트 불러오기
  const fetchDocs = (webappUrl) => {
    setLoading(true);
    fetch(`${webappUrl}?action=list`)
      .then((res) => res.json())
      .then((data) => {
        setDocs(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  if (loading) return <ActivityIndicator size="large" style={{ flex: 1 }} />;

  // 보드 선택 화면
  if (!selectedBoard) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>보드 선택</Text>
        <FlatList
          data={boards}
          keyExtractor={(item) => item.boardName}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => {
                setSelectedBoard(item);
                fetchDocs(item.webappUrl);
              }}
            >
              <Text style={styles.docName}>{item.boardName}</Text>
              <Text style={styles.linkText}>{item.webappUrl}</Text>
            </TouchableOpacity>
          )}
        />
      </View>
    );
  }

  // 문서 리스트 화면
  return (
    <View style={styles.container}>
      <Button
        title="← 보드 선택으로"
        onPress={() => {
          setSelectedBoard(null);
          setDocs([]);
        }}
      />
      <Text style={styles.title}>{selectedBoard.boardName} 문서 리스트</Text>
      <FlatList
        data={docs}
        keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.docName}>{item.docName}</Text>
            <Text>작성자: {item.author}</Text>
            <Text numberOfLines={1}>요약: {item.summary}</Text>
            {/* 필요시 서명 상태, 문서 URL, 서명 URL 등 추가 */}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5", paddingTop: 40 },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 10,
  },
  card: {
    backgroundColor: "#fff",
    margin: 8,
    borderRadius: 10,
    padding: 16,
    elevation: 2,
  },
  docName: { fontWeight: "bold", fontSize: 16, marginBottom: 4 },
  linkText: { color: "#1976d2", marginTop: 4 },
});
