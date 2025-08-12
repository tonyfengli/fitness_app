import { Text as RNText } from 'react-native';
import { createText } from '@shopify/restyle';
import { Theme } from '../theme';

export const Text = createText<Theme>(RNText);