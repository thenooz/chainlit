import { MessageContext } from '@/contexts/MessageContext';
import { cn } from '@/lib/utils';
import { ArrowDown } from 'lucide-react';
import {
  MutableRefObject,
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react';
import { useContext } from 'react';

import { useChatMessages } from '@chainlit/react-client';

import { Button } from '@/components/ui/button';

interface Props {
  autoScrollUserMessage?: boolean;
  autoScrollRef?: MutableRefObject<boolean>;
  children: React.ReactNode;
  className?: string;
}

export default function ScrollContainer({
  autoScrollRef,
  autoScrollUserMessage,
  children,
  className
}: Props) {
  // Get streaming state from MessageContext
  const { isStreaming } = useContext(MessageContext);
  const ref = useRef<HTMLDivElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);
  const lastUserMessageRef = useRef<HTMLDivElement | null>(null);
  const { messages } = useChatMessages();
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);

  // Calculate and update spacer height to keep last user message visible
  const updateSpacerHeight = useCallback(() => {
    if (!ref.current || !lastUserMessageRef.current || !spacerRef.current)
      return;

    // Only adjust spacer when streaming to keep the user message fixed at top
    if (isStreaming) {
      const containerHeight = ref.current.clientHeight;
      const lastMessageTop = lastUserMessageRef.current.offsetTop;
      const lastMessageHeight = lastUserMessageRef.current.offsetHeight;

      // Calculate space needed to keep the message at top with some padding
      const newSpacerHeight = Math.max(
        0,
        containerHeight - (lastMessageTop + lastMessageHeight) + 20
      );

      spacerRef.current.style.height = `${newSpacerHeight}px`;

      // Keep the last user message in view
      ref.current.scrollTop = lastMessageTop - 20;
    } else {
      // When not streaming, remove the spacer
      spacerRef.current.style.height = '0px';
    }
  }, [isStreaming]);

  // Handle message updates and scrolling
  useEffect(() => {
    if (!ref.current) return;

    // Reset spacer if no messages
    if (messages.length === 0 && spacerRef.current) {
      spacerRef.current.style.height = '0px';
      return;
    }

    // Find all user messages
    const userMessages = ref.current.querySelectorAll(
      '[data-step-type="user_message"]'
    );

    if (userMessages.length > 0) {
      const lastUserMessage = userMessages[
        userMessages.length - 1
      ] as HTMLDivElement;
      lastUserMessageRef.current = lastUserMessage;

      // If a new user message was added (length changed)
      if (messages[messages.length - 1]?.type === 'user_message') {
        // Scroll to position the message at the top
        scrollToPosition();
      } else if (!isStreaming) {
        // If not streaming and not a new user message, scroll to bottom
        scrollToBottom();
      }

      // Update spacer height to maintain position during streaming
      updateSpacerHeight();
    }
  }, [messages, isStreaming, updateSpacerHeight]);

  // Add window resize listener to update spacer height
  useEffect(() => {
    if (!autoScrollUserMessage) return;

    const handleResize = () => {
      updateSpacerHeight();
    };

    window.addEventListener('resize', handleResize);

    // Initial update
    updateSpacerHeight();

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [autoScrollUserMessage, updateSpacerHeight]);

  // Check scroll position on mount
  useEffect(() => {
    if (!ref.current) return;

    setTimeout(() => {
      if (!ref.current) return;

      const { scrollTop, scrollHeight, clientHeight } = ref.current;
      const atBottom = scrollTop + clientHeight >= scrollHeight - 10;
      setShowScrollButton(!atBottom);
    }, 500);
  }, []);

  const checkScrollEnd = () => {
    if (!ref.current) return;

    const prevScrollTop = ref.current.scrollTop;

    setTimeout(() => {
      if (!ref.current) return;

      const currentScrollTop = ref.current.scrollTop;
      if (currentScrollTop === prevScrollTop) {
        setIsScrolling(false);

        const { scrollTop, scrollHeight, clientHeight } = ref.current;
        const atBottom = scrollTop + clientHeight >= scrollHeight - 10;
        setShowScrollButton(!atBottom);
      } else {
        checkScrollEnd();
      }
    }, 100);
  };

  const scrollToBottom = () => {
    if (!ref.current) return;

    setIsScrolling(true);
    ref.current.scrollTo({
      top: ref.current.scrollHeight,
      behavior: 'smooth'
    });

    if (autoScrollRef) {
      autoScrollRef.current = true;
    }

    setShowScrollButton(false);
    checkScrollEnd();
  };

  const scrollToPosition = () => {
    if (!ref.current || !lastUserMessageRef.current) return;

    setIsScrolling(true);

    // Position the last user message at the top with padding
    const scrollPosition = lastUserMessageRef.current.offsetTop - 20;

    ref.current.scrollTo({
      top: scrollPosition,
      behavior: 'smooth'
    });

    // After scrolling to position, update the spacer to maintain the position
    requestAnimationFrame(() => {
      updateSpacerHeight();
      setShowScrollButton(false);
      checkScrollEnd();
    });
  };

  const handleScroll = () => {
    if (!ref.current || isScrolling) return;
    const { scrollTop, scrollHeight, clientHeight } = ref.current;
    const atBottom = scrollTop + clientHeight >= scrollHeight - 10;

    if (autoScrollRef) {
      autoScrollRef.current = atBottom;
    }

    setShowScrollButton(!atBottom);
  };

  return (
    <div className="relative flex flex-col flex-grow overflow-y-auto">
      <div
        ref={ref}
        className={cn('flex flex-col flex-grow overflow-y-auto', className)}
        onScroll={handleScroll}
      >
        {children}
        {/* Dynamic spacer to position the last user message at the top */}
        <div ref={spacerRef} className="flex-shrink-0" />
      </div>

      {showScrollButton ? (
        <div className="absolute bottom-4 left-0 right-0 flex justify-center">
          <Button
            size="icon"
            variant="outline"
            className="rounded-full"
            onClick={scrollToBottom}
          >
            <ArrowDown className="size-4" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
